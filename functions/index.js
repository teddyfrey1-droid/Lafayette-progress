const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// Super admin (doit correspondre au front)
const SUPER_ADMIN_EMAIL = "teddy.frey1@gmail.com";

// Région par défaut (doit correspondre au front)
const REGION = "europe-west1";

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

function getEmailConfig() {
  // 1) Env vars (recommandé)
  // 2) functions:config:set smtp.host=... smtp.port=... smtp.user=... smtp.pass=... mail.from=...
  const cfg = (() => {
    try {
      return functions.config() || {};
    } catch (e) {
      return {};
    }
  })();

  const smtpCfg = cfg.smtp || {};
  const mailCfg = cfg.mail || {};

  const host = process.env.SMTP_HOST || smtpCfg.host;
  const portRaw = process.env.SMTP_PORT || smtpCfg.port;
  const user = process.env.SMTP_USER || smtpCfg.user;
  const pass = process.env.SMTP_PASS || smtpCfg.pass;
  const from = process.env.MAIL_FROM || mailCfg.from;

  const port = portRaw ? Number(portRaw) : null;
  if (!host || !port || !user || !pass || !from) return null;
  return { host, port, user, pass, from };
}

function getTransport() {
  const cfg = getEmailConfig();
  if (!cfg) return null;

  const secure = cfg.port === 465; // convention
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
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

  const transport = getTransport();
  const cfg = getEmailConfig();
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

  const transport = getTransport();
  const cfg = getEmailConfig();
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
