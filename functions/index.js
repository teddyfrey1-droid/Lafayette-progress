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
    let from = v.from ? String(v.from).trim() : "";
    const secure = v.secure !== undefined ? !!v.secure : (port === 465);
    
    // CORRECTION CRITIQUE : Si Gmail, forcer le FROM à correspondre au user
    if (user && String(user).toLowerCase().endsWith("@gmail.com")) {
      const u = String(user).trim();
      if (!from || !String(from).includes(u)) {
        from = u;
      }
    }
    
    return { host, port, user, pass, from, secure };
  } catch (e) {
    console.error("Error loading SMTP config from RTDB:", e);
    return null;
  }
}

function makeTransport(cfg) {
  return nodemailer.createTransporter({
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
  
  console.log(`Resolving email for uid: ${u}`);
  
  // 1) RTDB
  try {
    const snap = await admin.database().ref(`users/${u}/email`).get();
    if (snap.exists() && snap.val()) {
      const e = String(snap.val()).trim();
      if (e) {
        console.log(`Email found in RTDB: ${e}`);
        return e;
      }
    }
  } catch (e) {
    console.error(`Error reading email from RTDB for ${u}:`, e);
  }

  // 2) Firebase Auth
  try {
    const rec = await admin.auth().getUser(u);
    const e = rec && rec.email ? String(rec.email).trim() : "";
    if (e) {
      console.log(`Email found in Auth: ${e}`);
      // Cache best-effort into RTDB
      try { 
        await admin.database().ref(`users/${u}/email`).set(e); 
        console.log(`Cached email in RTDB for ${u}`);
      } catch (e2) {
        console.error(`Error caching email in RTDB for ${u}:`, e2);
      }
      return e;
    }
  } catch (e) {
    console.error(`Error reading email from Auth for ${u}:`, e);
  }

  console.log(`No email found for uid: ${u}`);
  return "";
}

async function resolveManyEmails(uids) {
  const map = {};
  
  console.log(`Resolving emails for ${uids.length} users`);
  
  // Batch lookup in Auth
  try {
    const res = await admin.auth().getUsers(uids.map((uid) => ({ uid })));
    const updates = {};
    
    for (const userRecord of (res.users || [])) {
      if (userRecord && userRecord.uid && userRecord.email) {
        const u = String(userRecord.uid).trim();
        const e = String(userRecord.email).trim();
        if (u && e) {
          map[u] = e;
          updates[`users/${u}/email`] = e;
          console.log(`Resolved email for ${u}: ${e}`);
        }
      }
    }
    
    // Best-effort cache write (ignore errors)
    if (Object.keys(updates).length) {
      try { 
        await admin.database().ref().update(updates); 
        console.log(`Cached ${Object.keys(updates).length} emails in RTDB`);
      } catch (e3) {
        console.error("Error caching emails in RTDB:", e3);
      }
    }
  } catch (e) {
    console.error("Error in batch email resolution:", e);
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
      return { 
        uid: ur && ur.uid ? String(ur.uid).trim() : "", 
        email: ur && ur.email ? String(ur.email).trim() : String(raw).trim() 
      };
    } catch (e) {
      console.error(`Error resolving email ${raw} to uid:`, e);
      return { uid: "", email: "", error: String(e && e.message ? e.message : e) };
    }
  }

  return { uid: raw, email: "" };
}

/**
 * Envoi EMAIL vers 1 utilisateur (par uid) — réservé admin/superadmin
 * Entrée: { uid, subject, body, link?, email? }
 */
exports.sendEmailToUser = functions.region(REGION).https.onCall(async (data, context) => {
  try {
    await assertAdmin(context);

    console.log("sendEmailToUser called", { 
      callerUid: context.auth.uid, 
      target: (data&&data.uid)?String(data.uid):"" 
    });

    const inputId = data && data.uid ? String(data.uid).trim() : "";
    if (!inputId) {
      throw new functions.https.HttpsError("invalid-argument", "uid required");
    }

    const norm = await normalizeUidOrEmail(inputId);
    const uid = norm.uid;
    if (!uid) {
      // if user typed an email but it's not an Auth user
      console.error("No uid found for input:", inputId);
      return { ok: false, reason: "NO_USER", error: norm.error || "User not found" };
    }

    const subject = safeSubject(data && data.subject ? data.subject : "Message");
    const body = data && data.body ? String(data.body) : "";
    const link = data && data.link ? String(data.link) : "";

    // PRIORITÉ: email fourni par le client > email résolu
    let to = "";
    const emailFromClient = (data && data.email) ? String(data.email).trim() : "";
    if (emailFromClient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFromClient)) {
      to = emailFromClient;
      console.log(`Using email from client: ${to}`);
    }

    if (!to && norm && norm.email) { 
      to = String(norm.email).trim(); 
      console.log(`Using email from normalized input: ${to}`);
    }

    if (!to) {
      to = await resolveUserEmail(uid);
    }
    
    if (!to) {
      console.error(`No email found for uid: ${uid}`);
      return { ok: false, reason: "NO_EMAIL" };
    }

    const { cfg, transport } = await getTransportOrThrow();
    if (!transport || !cfg) {
      console.error("Email transport not configured");
      return { ok: false, reason: "EMAIL_NOT_CONFIGURED" };
    }

    const text = buildText(body, link);

    console.log(`Sending email to ${to} with subject: ${subject}`);

    try {
      const info = await transport.sendMail({
        from: cfg.from,
        to,
        subject,
        text,
      });
      console.log(`Email sent successfully to ${to}:`, info.messageId);
      return { ok: true, to, messageId: info && info.messageId ? info.messageId : null };
    } catch (e) {
      console.error(`Failed to send email to ${to}:`, e);
      return { 
        ok: false, 
        reason: "SEND_FAILED", 
        error: String(e && e.message ? e.message : e), 
        errorCode: (e && e.code) ? String(e.code) : "", 
        detail: (e && (e.responseCode || e.command)) ? (`${e.responseCode||""} ${e.command||""}`).trim() : "" 
      };
    }

  } catch (err) {
    console.error("sendEmailToUser fatal error:", err);
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
 * Entrée: { uids: string[], subject, body, link?, recipients?: [{uid, email}] }
 */
exports.sendEmailToUsers = functions.region(REGION).https.onCall(async (data, context) => {
  try {
    await assertAdmin(context);

    console.log("sendEmailToUsers called", { 
      callerUid: context.auth.uid, 
      uidsLen: Array.isArray(data && data.uids) ? data.uids.length : 0 
    });

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
    if (!transport || !cfg) {
      console.error("Email transport not configured");
      return { ok: false, reason: "EMAIL_NOT_CONFIGURED", results: [] };
    }

    const text = buildText(body, link);

    // Construire emailMap depuis recipients (priorité) puis résolution batch
    const emailMap = {};
    const recipients = (data && Array.isArray(data.recipients)) ? data.recipients : [];
    
    for (const r of recipients) {
      const ru = r && r.uid ? String(r.uid).trim() : "";
      const reml = r && r.email ? String(r.email).trim() : "";
      if (ru && reml && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reml)) {
        emailMap[ru] = reml;
        console.log(`Using email from recipients for ${ru}: ${reml}`);
      }
    }

    // Résoudre les emails manquants en batch
    const missing = uids.filter(uid => !emailMap[uid]);
    if (missing.length) {
      console.log(`Resolving ${missing.length} missing emails`);
      const resolved = await resolveManyEmails(missing);
      Object.assign(emailMap, resolved);
    }

    const results = [];
    
    // Handle inputs that couldn't be resolved to an Auth user
    for (const id of inputs) {
      const u = inputToUid[id];
      if (!u) {
        results.push({ uid: id, ok: false, reason: "NO_USER" });
      }
    }

    // Envoyer les emails
    for (const uid of uids) {
      const to = emailMap[uid] ? String(emailMap[uid]).trim() : "";
      
      if (!to) {
        console.error(`No email found for uid: ${uid}`);
        results.push({ uid, ok: false, reason: "NO_EMAIL" });
        continue;
      }

      console.log(`Sending email to ${to} for uid ${uid}`);

      try {
        const info = await transport.sendMail({
          from: cfg.from,
          to,
          subject,
          text,
        });
        console.log(`Email sent successfully to ${to} (uid: ${uid}):`, info.messageId);
        results.push({ 
          uid, 
          ok: true, 
          to, 
          messageId: info && info.messageId ? info.messageId : null 
        });
      } catch (e) {
        console.error(`Failed to send email to ${to} (uid: ${uid}):`, e);
        results.push({ 
          uid, 
          ok: false, 
          to, 
          reason: "SEND_FAILED", 
          error: String(e && e.message ? e.message : e), 
          errorCode: (e && e.code) ? String(e.code) : "", 
          detail: (e && (e.responseCode || e.command)) ? (`${e.responseCode||""} ${e.command||""}`).trim() : "" 
        });
      }
    }

    console.log(`Batch email results: ${results.filter(r => r.ok).length}/${results.length} successful`);
    return { ok: true, results };

  } catch (err) {
    console.error("sendEmailToUsers fatal error:", err);
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
  let from = data && data.from ? String(data.from).trim() : "";
  const secure = data && data.secure !== undefined ? !!data.secure : (port === 465);

  // CORRECTION CRITIQUE : Si Gmail, forcer le FROM à correspondre au user
  if (user && String(user).toLowerCase().endsWith("@gmail.com")) {
    const u = String(user).trim();
    if (!from || !String(from).includes(u)) {
      from = u;
      console.log(`Gmail detected, forcing FROM to: ${from}`);
    }
  }

  const cfg = { host, port, user, pass, from, secure, updatedAt: Date.now() };
  const missing = _validateSmtp(cfg);
  if (missing.length) {
    throw new functions.https.HttpsError("invalid-argument", "SMTP_INCOMPLETE", { missing });
  }

  await admin.database().ref(SMTP_CONFIG_PATH).set(cfg);
  console.log("SMTP config saved successfully");
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
    } catch (e) {
      console.error("Error getting caller email:", e);
    }
  }
  
  if (!to) {
    throw new functions.https.HttpsError("invalid-argument", "to required");
  }

  const { cfg, transport } = await getTransportOrThrow();
  
  console.log(`Testing SMTP by sending email to ${to}`);
  
  try {
    const info = await transport.sendMail({
      from: cfg.from,
      to,
      subject: "Test SMTP — Heiko Lafayette Progress",
      text: "Si tu reçois cet email, la configuration SMTP fonctionne.",
    });
    console.log(`Test email sent successfully to ${to}:`, info.messageId);
    return { ok: true, to, messageId: info && info.messageId ? info.messageId : null };
  } catch (e) {
    console.error(`Failed to send test email to ${to}:`, e);
    return { 
      ok: false, 
      reason: "SEND_FAILED", 
      error: String(e && e.message ? e.message : e), 
      errorCode: (e && e.code) ? String(e.code) : "", 
      detail: (e && (e.responseCode || e.command)) ? (`${e.responseCode||""} ${e.command||""}`).trim() : "" 
    };
  }
});
