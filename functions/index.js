const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// Super admin (doit correspondre au front)
const SUPER_ADMIN_EMAIL = "teddy.frey1@gmail.com";

// Région par défaut (doit correspondre au front)
const REGION = "us-central1";

// SMTP configuré dans RTDB (évite la CLI)
const SMTP_CONFIG_PATH = "configPrivate/smtp";

function isAdminRole(role) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "superadmin";
}

async function assertAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Auth required");
  }

  const uid = context.auth.uid;
  const roleSnap = await admin.database().ref(`users/${uid}/role`).get();
  const role = roleSnap.exists() ? String(roleSnap.val()) : "";

  // fallback: si superadmin par email (Auth)
  let email = "";
  try {
    const userRecord = await admin.auth().getUser(uid);
    email = userRecord && userRecord.email ? String(userRecord.email) : "";
  } catch (e) {}

  const isSuperAdminEmail =
    email && String(email).toLowerCase() === String(SUPER_ADMIN_EMAIL).toLowerCase();

  if (!isAdminRole(role) && !isSuperAdminEmail) {
    throw new functions.https.HttpsError("permission-denied", "Admin required");
  }
}

function _readEnvSmtp() {
  const host = process.env.SMTP_HOST ? String(process.env.SMTP_HOST).trim() : "";
  const portRaw = process.env.SMTP_PORT ? String(process.env.SMTP_PORT).trim() : "";
  const user = process.env.SMTP_USER ? String(process.env.SMTP_USER).trim() : "";
  const pass = process.env.SMTP_PASS ? String(process.env.SMTP_PASS) : "";
  const from = process.env.MAIL_FROM ? String(process.env.MAIL_FROM).trim() : "";
  const secureRaw = process.env.SMTP_SECURE ? String(process.env.SMTP_SECURE).trim() : "";
  const port = portRaw ? Number(portRaw) : 0;
  const secure = secureRaw ? ["1","true","yes","y","on"].includes(secureRaw.toLowerCase()) : (port === 465);
  return { host, port, user, pass, from, secure };
}

function _readFunctionsConfigSmtp() {
  // Supporte l'ancien functions.config() (si présent)
  const cfg = (() => {
    try { return functions.config() || {}; } catch (e) { return {}; }
  })();

  const smtpCfg = cfg.smtp || {};
  const mailCfg = cfg.mail || {};
  const host = smtpCfg.host ? String(smtpCfg.host).trim() : "";
  const port = smtpCfg.port ? Number(String(smtpCfg.port).trim()) : 0;
  const user = smtpCfg.user ? String(smtpCfg.user).trim() : "";
  const pass = smtpCfg.pass ? String(smtpCfg.pass) : "";
  const from = mailCfg.from ? String(mailCfg.from).trim() : "";
  const secure = smtpCfg.secure !== undefined ? !!smtpCfg.secure : (port === 465);

  return { host, port, user, pass, from, secure };
}

function _validateSmtp(cfg) {
  const missing = [];
  if (!cfg || !cfg.host) missing.push("host");
  if (!cfg || !cfg.port) missing.push("port");
  if (!cfg || !cfg.user) missing.push("user");
  if (!cfg || !cfg.pass) missing.push("pass");
  if (!cfg || !cfg.from) missing.push("from");
  return missing;
}

async function loadSmtpConfig() {
  // Priorité: env > functions.config() > RTDB
  const envCfg = _readEnvSmtp();
  if (_validateSmtp(envCfg).length === 0) return envCfg;

  const fcCfg = _readFunctionsConfigSmtp();
  if (_validateSmtp(fcCfg).length === 0) return fcCfg;

  try {
    const snap = await admin.database().ref(SMTP_CONFIG_PATH).get();
    if (!snap.exists()) return null;
    const v = snap.val() || {};
    const host = v.host ? String(v.host).trim() : "";
    const port = v.port ? Number(v.port) : 0;
    const user = v.user ? String(v.user).trim() : "";
    const pass = v.pass ? String(v.pass) : "";
    const from = v.from ? String(v.from).trim() : "";
    const secure = v.secure !== undefined ? !!v.secure : (port === 465);
    return { host, port, user, pass, from, secure };
  } catch (e) {
    return null;
  }
}

function makeTransport(cfg) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: !!cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

async function getTransportOrThrow() {
  const cfg = await loadSmtpConfig();
  const missing = _validateSmtp(cfg || {});
  if (missing.length) {
    const err = new functions.https.HttpsError(
      "failed-precondition",
      "EMAIL_NOT_CONFIGURED",
      { missing }
    );
    throw err;
  }
  const transport = makeTransport(cfg);
  return { cfg, transport };
}


function safeSubject(s) {
  const str = String(s || "Message").trim();
  if (!str) return "Message";
  return str.length > 140 ? str.slice(0, 140) : str;
}

function buildText(body, link) {
  const b = String(body || "").trim();
  const l = String(link || "").trim();
  return `${b}${l ? `\n\nLien: ${l}` : ""}`.trim();
}

/**
 * Envoi EMAIL vers 1 utilisateur (par uid) — réservé admin/superadmin
 * Entrée: { uid, subject, body, link? }
 */
exports.sendEmailToUser = functions.region(REGION).https.onCall(async (data, context) => {
  await assertAdmin(context);

  const uid = data && data.uid ? String(data.uid).trim() : "";
  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "uid required");
  }

  const subject = safeSubject(data && data.subject ? data.subject : "Message");
  const body = data && data.body ? String(data.body) : "";
  const link = data && data.link ? String(data.link) : "";

  const userSnap = await admin.database().ref(`users/${uid}`).get();
  const user = userSnap.exists() ? (userSnap.val() || {}) : {};
  const to = user.email ? String(user.email).trim() : "";
  if (!to) return { ok: false, reason: "NO_EMAIL" };

  const { cfg, transport } = await getTransportOrThrow();
  if (!transport || !cfg) return { ok: false, reason: "EMAIL_NOT_CONFIGURED" };

  const text = buildText(body, link);

  try {
    const info = await transport.sendMail({
      from: cfg.from,
      to,
      subject,
      text,
    });
    return { ok: true, to, messageId: info && info.messageId ? info.messageId : null };
  } catch (e) {
    return { ok: false, reason: "SEND_FAILED", error: String(e && e.message ? e.message : e) };
  }
});

/**
 * Envoi EMAIL vers plusieurs utilisateurs (uids[]) — réservé admin/superadmin
 * Entrée: { uids: string[], subject, body, link? }
 */
exports.sendEmailToUsers = functions.region(REGION).https.onCall(async (data, context) => {
  await assertAdmin(context);

  const uidsRaw = data && data.uids ? data.uids : [];
  const uids = Array.isArray(uidsRaw)
    ? uidsRaw.map((u) => String(u || "").trim()).filter(Boolean)
    : [];
  if (!uids.length) {
    throw new functions.https.HttpsError("invalid-argument", "uids required");
  }

  const subject = safeSubject(data && data.subject ? data.subject : "Message");
  const body = data && data.body ? String(data.body) : "";
  const link = data && data.link ? String(data.link) : "";

  const { cfg, transport } = await getTransportOrThrow();
  if (!transport || !cfg) return { ok: false, reason: "EMAIL_NOT_CONFIGURED", results: [] };

  const text = buildText(body, link);

  // On charge tous les users en 1 lecture pour éviter N requêtes
  const usersSnap = await admin.database().ref("users").get();
  const users = usersSnap.exists() ? (usersSnap.val() || {}) : {};

  const results = [];
  for (const uid of uids) {
    const u = users[uid] || {};
    const to = u.email ? String(u.email).trim() : "";
    if (!to) {
      results.push({ uid, ok: false, reason: "NO_EMAIL" });
      continue;
    }

    try {
      const info = await transport.sendMail({
        from: cfg.from,
        to,
        subject,
        text,
      });
      results.push({ uid, ok: true, to, messageId: info && info.messageId ? info.messageId : null });
    } catch (e) {
      results.push({ uid, ok: false, to, reason: "SEND_FAILED", error: String(e && e.message ? e.message : e) });
    }
  }

  return { ok: true, results };
});


/**
 * Lecture statut SMTP (sans renvoyer le mot de passe)
 * Retour: { configured: boolean, missing?: string[], host?, port?, user?, from?, secure? }
 */
exports.getSmtpConfigStatus = functions.region(REGION).https.onCall(async (data, context) => {
  await assertAdmin(context);
  const cfg = await loadSmtpConfig();
  const missing = _validateSmtp(cfg || {});
  if (missing.length) {
    return { configured: false, missing };
  }
  return {
    configured: true,
    host: cfg.host,
    port: cfg.port,
    user: cfg.user ? String(cfg.user).slice(0, 3) + "***" : "",
    from: cfg.from,
    secure: !!cfg.secure
  };
});

/**
 * Sauvegarde SMTP dans RTDB (évite la CLI)
 * Entrée: { host, port, user, pass, from, secure? }
 */
exports.setSmtpConfig = functions.region(REGION).https.onCall(async (data, context) => {
  await assertAdmin(context);

  const host = data && data.host ? String(data.host).trim() : "";
  const port = data && data.port ? Number(data.port) : 0;
  const user = data && data.user ? String(data.user).trim() : "";
  const pass = data && data.pass ? String(data.pass) : "";
  const from = data && data.from ? String(data.from).trim() : "";
  const secure = data && data.secure !== undefined ? !!data.secure : (port === 465);

  const cfg = { host, port, user, pass, from, secure, updatedAt: Date.now() };
  const missing = _validateSmtp(cfg);
  if (missing.length) {
    throw new functions.https.HttpsError("invalid-argument", "SMTP_INCOMPLETE", { missing });
  }

  await admin.database().ref(SMTP_CONFIG_PATH).set(cfg);
  return { ok: true };
});

/**
 * Test SMTP: envoie un email de test à "to" (ou à l'email du caller si absent)
 * Entrée: { to? }
 */
exports.testSmtp = functions.region(REGION).https.onCall(async (data, context) => {
  await assertAdmin(context);

  let to = data && data.to ? String(data.to).trim() : "";
  if (!to) {
    try {
      const userRecord = await admin.auth().getUser(context.auth.uid);
      to = userRecord && userRecord.email ? String(userRecord.email) : "";
    } catch (e) {}
  }
  if (!to) {
    throw new functions.https.HttpsError("invalid-argument", "to required");
  }

  const { cfg, transport } = await getTransportOrThrow();
  try {
    const info = await transport.sendMail({
      from: cfg.from,
      to,
      subject: "Test SMTP — Heiko Lafayette Progress",
      text: "Si tu reçois cet email, la configuration SMTP fonctionne.",
    });
    return { ok: true, to, messageId: info && info.messageId ? info.messageId : null };
  } catch (e) {
    return { ok: false, reason: "SEND_FAILED", error: String(e && e.message ? e.message : e) };
  }
});
