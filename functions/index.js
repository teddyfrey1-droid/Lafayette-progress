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
  let from = process.env.MAIL_FROM ? String(process.env.MAIL_FROM).trim() : "";
  const secureRaw = process.env.SMTP_SECURE ? String(process.env.SMTP_SECURE).trim() : "";
  const port = portRaw ? Number(portRaw) : 0;
  const secure = secureRaw ? ["1","true","yes","y","on"].includes(secureRaw.toLowerCase()) : (port === 465);
  // Gmail SMTP tends to reject a FROM address that doesn't match the authenticated account.
// If user is a gmail account, force the email part of FROM to be the SMTP user.
if (user && String(user).toLowerCase().endsWith("@gmail.com")) {
  const u = String(user).trim();
  if (!from || !String(from).includes(u)) {
    from = u;
  }
}

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

async function resolveUserEmail(uid) {
  const u = String(uid || "").trim();
  if (!u) return "";
  // 1) RTDB
  try {
    const snap = await admin.database().ref(`users/${u}/email`).get();
    if (snap.exists() && snap.val()) {
      const e = String(snap.val()).trim();
      if (e) return e;
    }
  } catch (e) {}

  // 2) Firebase Auth
  try {
    const rec = await admin.auth().getUser(u);
    const e = rec && rec.email ? String(rec.email).trim() : "";
    if (e) {
      // Cache best-effort into RTDB
      try { await admin.database().ref(`users/${u}/email`).set(e); } catch (e2) {}
      return e;
    }
  } catch (e) {}

  return "";
}

async function resolveManyEmails(uids, usersCache) {
  const map = {};
  const missing = [];

  const list = Array.isArray(uids) ? uids : [];
  for (const uid of list) {
    const u = String(uid || "").trim();
    if (!u) continue;
    const cached = usersCache && usersCache[u] && usersCache[u].email ? String(usersCache[u].email).trim() : "";
    if (cached) map[u] = cached;
    else missing.push(u);
  }

  if (!missing.length) return map;

  // Batch lookup in Auth for missing emails
  try {
    const res = await admin.auth().getUsers(missing.map((uid) => ({ uid })));
    const updates = {};
    for (const userRecord of (res.users || [])) {
      if (userRecord && userRecord.uid && userRecord.email) {
        const u = String(userRecord.uid).trim();
        const e = String(userRecord.email).trim();
        if (u && e) {
          map[u] = e;
          updates[`users/${u}/email`] = e;
          if (usersCache) usersCache[u] = { ...(usersCache[u] || {}), email: e };
        }
      }
    }
    // Best-effort cache write (ignore errors)
    if (Object.keys(updates).length) {
      try { await admin.database().ref().update(updates); } catch (e3) {}
    }
  } catch (e) {
    // ignore, map will just not contain these uids
  }

  return map;
}


async function normalizeUidOrEmail(id) {
  const raw = String(id || "").trim();
  if (!raw) return { uid: "", email: "" };

  // If input looks like an email, try to resolve to an Auth user.
  if (raw.includes("@")) {
    try {
      const ur = await admin.auth().getUserByEmail(raw);
      return { uid: ur && ur.uid ? String(ur.uid).trim() : "", email: ur && ur.email ? String(ur.email).trim() : String(raw).trim() };
    } catch (e) {
      return { uid: "", email: "", error: String(e && e.message ? e.message : e) };
    }
  }

  return { uid: raw, email: "" };
}



/**
 * Envoi EMAIL vers 1 utilisateur (par uid) — réservé admin/superadmin
 * Entrée: { uid, subject, body, link? }
 */
exports.sendEmailToUser = functions.region(REGION).https.onCall(async (data, context) => {
  try {
  await assertAdmin(context);

  console.log("sendEmailToUser called", { callerUid: context.auth.uid, target: (data&&data.uid)?String(data.uid):"" });

  const inputId = data && data.uid ? String(data.uid).trim() : "";
if (!inputId) {
  throw new functions.https.HttpsError("invalid-argument", "uid required");
}

const norm = await normalizeUidOrEmail(inputId);
const uid = norm.uid;
if (!uid) {
  // if user typed an email but it's not an Auth user
  return { ok: false, reason: "NO_USER", error: norm.error || "User not found" };
}

  const subject = safeSubject(data && data.subject ? data.subject : "Message");
  const body = data && data.body ? String(data.body) : "";
  const link = data && data.link ? String(data.link) : "";

  // IMPORTANT: ne jamais lire tout `users/{uid}` (peut être énorme).
  // On privilégie l'email fourni par le front, puis `users/{uid}/email`, puis Auth.
  let to = "";
  const emailFromClient = (data && data.email) ? String(data.email).trim() : "";
  if (emailFromClient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFromClient)) {
    to = emailFromClient;
  }

  if (!to && norm && norm.email) { to = String(norm.email).trim(); }

  if (!to) {
    try {
      const emailSnap = await admin.database().ref(`users/${uid}/email`).get();
      if (emailSnap.exists() && emailSnap.val()) {
        const e = String(emailSnap.val()).trim();
        if (e) to = e;
      }
    } catch (e) {}
  }

  if (!to) {
    to = await resolveUserEmail(uid);
  }
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
    return { ok: false, reason: "SEND_FAILED", error: String(e && e.message ? e.message : e), errorCode: (e && e.code) ? String(e.code) : "", detail: (e && (e.responseCode || e.command)) ? (`${e.responseCode||""} ${e.command||""}`).trim() : "" };
  }

  } catch (err) {
    console.error("sendEmailToUser fatal", err);
    // Si c'est déjà une HttpsError, on la relance telle quelle
    if (err instanceof functions.https.HttpsError) {
      throw err;
    }
    const msg = String((err && err.message) ? err.message : err);
    const stack = String((err && err.stack) ? err.stack : "");
    throw new functions.https.HttpsError("internal", "INTERNAL", {
      fn: "sendEmailToUser",
      message: msg,
      stack: stack.slice(0, 2000)
    });
  }
});

/**
 * Envoi EMAIL vers plusieurs utilisateurs (uids[]) — réservé admin/superadmin
 * Entrée: { uids: string[], subject, body, link? }
 */
exports.sendEmailToUsers = functions.region(REGION).https.onCall(async (data, context) => {
  try {
  await assertAdmin(context);

  console.log("sendEmailToUsers called", { callerUid: context.auth.uid, uidsLen: Array.isArray(data && data.uids) ? data.uids.length : 0 });

  const uidsRaw = data && data.uids ? data.uids : [];
const inputs = Array.isArray(uidsRaw)
  ? uidsRaw.map((u) => String(u || "").trim()).filter(Boolean)
  : [];
if (!inputs.length) {
  throw new functions.https.HttpsError("invalid-argument", "uids required");
}

// Normalize (uids or emails) -> uids
const normList = [];
const inputToUid = {};
for (const id of inputs) {
  const n = await normalizeUidOrEmail(id);
  if (n && n.uid) {
    normList.push(n.uid);
    inputToUid[id] = n.uid;
  } else {
    inputToUid[id] = "";
  }
}
const uids = Array.from(new Set(normList)); // dedupe

  const subject = safeSubject(data && data.subject ? data.subject : "Message");
  const body = data && data.body ? String(data.body) : "";
  const link = data && data.link ? String(data.link) : "";

  const { cfg, transport } = await getTransportOrThrow();
  if (!transport || !cfg) return { ok: false, reason: "EMAIL_NOT_CONFIGURED", results: [] };

  const text = buildText(body, link);

  // IMPORTANT: ne jamais lire tout `/users` (peut être énorme).
  // Option: le front peut envoyer `recipients: [{uid,email}]` pour éviter tout lookup.
  const emailMap = {};
  const recipients = (data && Array.isArray(data.recipients)) ? data.recipients : [];
  for (const r of recipients) {
    const ru = r && r.uid ? String(r.uid).trim() : "";
    const reml = r && r.email ? String(r.email).trim() : "";
    if (ru && reml && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reml)) {
      emailMap[ru] = reml;
    }
  }

  const missing = [];
  for (const uid of uids) {
    if (emailMap[uid]) continue;
    try {
      const snap = await admin.database().ref(`users/${uid}/email`).get();
      if (snap.exists() && snap.val()) {
        const e = String(snap.val()).trim();
        if (e) { emailMap[uid] = e; continue; }
      }
    } catch (e2) {}
    missing.push(uid);
  }

  // Batch lookup in Auth for remaining missing emails (best effort)
  if (missing.length) {
    try {
      const res = await admin.auth().getUsers(missing.map((u) => ({ uid: u })));
      const updates = {};
      for (const userRecord of (res.users || [])) {
        if (userRecord && userRecord.uid && userRecord.email) {
          const u = String(userRecord.uid).trim();
          const e = String(userRecord.email).trim();
          if (u && e) {
            emailMap[u] = e;
            updates[`users/${u}/email`] = e;
          }
        }
      }
      if (Object.keys(updates).length) {
        try { await admin.database().ref().update(updates); } catch (e3) {}
      }
    } catch (e) {}
  }

  const results = [];
// Handle inputs that couldn't be resolved to an Auth user (typed emails not found, etc.)
for (const id of inputs) {
  const u = inputToUid[id];
  if (!u) {
    results.push({ uid: id, ok: false, reason: "NO_USER" });
  }
}

for (const uid of uids) {

    const to = emailMap[uid] ? String(emailMap[uid]).trim() : "";
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
      results.push({ uid, ok: false, to, reason: "SEND_FAILED", error: String(e && e.message ? e.message : e), errorCode: (e && e.code) ? String(e.code) : "", detail: (e && (e.responseCode || e.command)) ? (`${e.responseCode||""} ${e.command||""}`).trim() : "" });
    }
  }

  return { ok: true, results };

  } catch (err) {
    console.error("sendEmailToUsers fatal", err);
    // Si c'est déjà une HttpsError, on la relance telle quelle
    if (err instanceof functions.https.HttpsError) {
      throw err;
    }
    const msg = String((err && err.message) ? err.message : err);
    const stack = String((err && err.stack) ? err.stack : "");
    throw new functions.https.HttpsError("internal", "INTERNAL", {
      fn: "sendEmailToUsers",
      message: msg,
      stack: stack.slice(0, 2000)
    });
  }
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
    return { ok: false, reason: "SEND_FAILED", error: String(e && e.message ? e.message : e), errorCode: (e && e.code) ? String(e.code) : "", detail: (e && (e.responseCode || e.command)) ? (`${e.responseCode||""} ${e.command||""}`).trim() : "" };
  }
});
