const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// Super admin (doit correspondre au front)
const SUPER_ADMIN_EMAIL = "teddy.frey1@gmail.com";

// Région par défaut (doit correspondre au front). Changeable côté front si vous déployez ailleurs.
const REGION = "europe-west1";

/**
 * Envoie une notification (FCM) à des tokens stockés dans RTDB: /fcmTokens/{uid}/{pushId}
 * Sécurité: réservé aux utilisateurs role = 'admin' ou 'superadmin' (dans /users/{uid}/role)
 *
 * Appel (Callable):
 *  - title (string)
 *  - body (string)
 *  - link (string, optionnel) ex: "/index.html#dashboard"
 *  - audience ("all" | "team" | "admins")
 *  - emailFallback (boolean) : si true, envoie aussi un email aux utilisateurs qui n'ont pas activé les push
 *
 * IMPORTANT: l'email fallback nécessite une config SMTP côté Cloud Functions.
 */

async function assertAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Auth required");
  }

  const uid = context.auth.uid;
  const roleSnap = await admin.database().ref(`users/${uid}/role`).get();
  const role = roleSnap.exists() ? String(roleSnap.val()) : "";

  const authEmail = context && context.auth && context.auth.token && context.auth.token.email ? String(context.auth.token.email).toLowerCase() : "";
  const isSuperByEmail = authEmail && authEmail === SUPER_ADMIN_EMAIL.toLowerCase();

  if (role !== "admin" && role !== "superadmin" && !isSuperByEmail) {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  return { uid, role: role || (isSuperByEmail ? "superadmin" : "") };
}

function normalizeAudience(aud) {
  const v = String(aud || "all").trim().toLowerCase();
  if (v === "admins") return "admins";
  if (v === "team") return "team";
  return "all";
}

function isAdminRole(role) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "superadmin";
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

function isValidEmail(email) {
  const e = String(email || "").trim();
  if (!e) return false;
  // Validation light (suffit pour éviter des erreurs évidentes)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

async function collectRecipientsByAudience(audience) {
  const usersSnap = await admin.database().ref("users").get();
  const users = usersSnap.exists() ? (usersSnap.val() || {}) : {};

  const out = [];
  Object.keys(users).forEach((uid) => {
    const u = users[uid] || {};
    const role = u.role || "";
    const adminRole = isAdminRole(role);

    if (audience === "admins" && !adminRole) return;
    if (audience === "team" && adminRole) return;

    out.push({
      uid,
      role,
      email: u.email || "",
      name: u.name || "",
      pushEnabled: !!u.pushEnabled,
    });
  });

  return out;
}

async function collectTokenEntriesForRecipients(recipients) {
  const tokensSnap = await admin.database().ref("fcmTokens").get();
  const allTokens = tokensSnap.exists() ? (tokensSnap.val() || {}) : {};

  const tokenEntries = [];
  const emailRecipients = [];

  for (const r of recipients) {
    const uid = r.uid;
    const pushEnabled = !!r.pushEnabled;

    const userTokens = (allTokens && allTokens[uid]) ? allTokens[uid] : null;
    const tokenKeys = userTokens ? Object.keys(userTokens) : [];

    // On ne compte que si l'utilisateur a activé les push + token présent
    if (pushEnabled && tokenKeys.length) {
      tokenKeys.forEach((k) => {
        const t = userTokens[k] && userTokens[k].token;
        if (t && typeof t === "string") tokenEntries.push({ token: t, uid, key: k });
      });
    } else {
      // Pas de push activé -> candidat email fallback
      if (isValidEmail(r.email)) {
        emailRecipients.push({ uid, email: String(r.email).trim(), name: r.name || "" });
      }
    }
  }

  return { tokenEntries, emailRecipients };
}

async function sendPushInChunks({ title, body, link, tokenEntries }) {
  if (!tokenEntries.length) {
    return { ok: false, sent: 0, failed: 0, total: 0, reason: "No tokens" };
  }

  const chunks = [];
  for (let i = 0; i < tokenEntries.length; i += 500) {
    chunks.push(tokenEntries.slice(i, i + 500));
  }

  let sent = 0;
  let failed = 0;
  const toDelete = [];

  for (const chunkEntries of chunks) {
    const chunkTokens = chunkEntries.map((x) => x.token);

    const message = {
      tokens: chunkTokens,
      notification: { title, body },
      data: { link: String(link || "/index.html#dashboard") },
      webpush: {
        fcmOptions: { link: String(link || "/index.html#dashboard") },
      },
    };

    const res = await admin.messaging().sendEachForMulticast(message);
    sent += res.successCount;
    failed += res.failureCount;

    // Nettoyage tokens invalides
    (res.responses || []).forEach((r, idx) => {
      if (r.success) return;
      const code = r.error && r.error.code ? String(r.error.code) : "";
      if (
        code.includes("registration-token-not-registered") ||
        code.includes("invalid-registration-token")
      ) {
        const entry = chunkEntries[idx];
        if (entry && entry.uid && entry.key) {
          toDelete.push({ uid: entry.uid, key: entry.key });
        }
      }
    });
  }

  if (toDelete.length) {
    const updates = {};
    toDelete.forEach((d) => {
      updates[`fcmTokens/${d.uid}/${d.key}`] = null;
    });
    try {
      await admin.database().ref().update(updates);
    } catch (e) {
      // ignore
    }
  }

  return { ok: true, sent, failed, total: tokenEntries.length, cleaned: toDelete.length };
}

async function sendEmails({ title, body, link, emailRecipients }) {
  const transport = getTransport();
  if (!transport) {
    return { ok: false, sent: 0, total: emailRecipients.length, reason: "Email not configured" };
  }
  if (!emailRecipients.length) return { ok: true, sent: 0, total: 0 };

  const cfg = getEmailConfig();
  const from = cfg.from;

  const subject = `[Heiko Lafayette] ${title}`;
  const text = `${title}\n\n${body}\n\n${link ? "Lien: " + link : ""}`.trim();

  // envoi séquentiel (simple et fiable)
  let sent = 0;
  for (const r of emailRecipients) {
    try {
      await transport.sendMail({
        from,
        to: r.email,
        subject,
        text,
      });
      sent += 1;
    } catch (e) {
      // ignore individual failures
    }
  }

  return { ok: true, sent, total: emailRecipients.length };
}

async function sendNotification({ title, body, link, audience, emailFallback }) {
  const recipients = await collectRecipientsByAudience(audience);
  const { tokenEntries, emailRecipients } = await collectTokenEntriesForRecipients(recipients);

  const pushRes = await sendPushInChunks({ title, body, link, tokenEntries });

  let emailRes = { ok: false, sent: 0, total: 0, reason: "disabled" };
  if (emailFallback) {
    emailRes = await sendEmails({ title, body, link, emailRecipients });
  }

  return {
    ok: true,
    audience,
    // compat front: "sent" = push sent
    sent: pushRes.sent || 0,
    failed: pushRes.failed || 0,
    total: pushRes.total || 0,
    cleaned: pushRes.cleaned || 0,
    emailFallback: !!emailFallback,
    emailSent: emailRes.sent || 0,
    emailTotal: emailRes.total || 0,
    emailOk: !!emailRes.ok,
    emailReason: emailRes.ok ? null : (emailRes.reason || null),
  };
}

/**
 * Callable utilisé par le front: sendPush
 */
exports.sendPush = functions.region(REGION).https.onCall(async (data, context) => {
  await assertAdmin(context);

  const title = (data && data.title) ? String(data.title) : "Heiko";
  const body = (data && data.body) ? String(data.body) : "";
  const link = (data && data.link) ? String(data.link) : "/index.html#dashboard";
  const audience = normalizeAudience(data && data.audience);
  const emailFallback = !!(data && data.emailFallback);

  return await sendNotification({ title, body, link, audience, emailFallback });
});

// Compat: ancien nom (ou usage direct)
exports.sendPushToAll = functions.region(REGION).https.onCall(async (data, context) => {
  await assertAdmin(context);
  const title = (data && data.title) ? String(data.title) : "Heiko";
  const body = (data && data.body) ? String(data.body) : "";
  const link = (data && data.link) ? String(data.link) : "/index.html#dashboard";
  const emailFallback = !!(data && data.emailFallback);
  return await sendNotification({ title, body, link, audience: "all", emailFallback });
});

/**
 * Callable utilisé par le front: sendEmailToUser
 * Envoie un email à un utilisateur précis (uid) en utilisant l'email stocké dans RTDB /users/{uid}/email.
 */
exports.sendEmailToUser = functions.region(REGION).https.onCall(async (data, context) => {
  await assertAdmin(context);

  const uid = data && data.uid ? String(data.uid).trim() : "";
  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "uid required");
  }

  const subject = data && data.subject ? String(data.subject) : "Message";
  const body = data && data.body ? String(data.body) : "";
  const link = data && data.link ? String(data.link) : "";

  const userSnap = await admin.database().ref(`users/${uid}`).get();
  const user = userSnap.exists() ? (userSnap.val() || {}) : {};
  const to = user.email ? String(user.email).trim() : "";

  if (!isValidEmail(to)) {
    throw new functions.https.HttpsError("not-found", "recipient email not found");
  }

  const transport = getTransport();
  if (!transport) {
    return { ok: false, reason: "Email not configured" };
  }

  const cfg = getEmailConfig();
  const from = cfg.from;

  const safeSubject = subject.slice(0, 200);
  const text = `${body}${link ? `\n\nLien: ${link}` : ""}`.trim();

  try {
    const info = await transport.sendMail({
      from,
      to,
      subject: safeSubject,
      text,
    });

    return { ok: true, to, messageId: info && info.messageId ? info.messageId : null };
  } catch (e) {
    return { ok: false, reason: "SEND_FAILED", error: String(e && e.message ? e.message : e) };
  }
});
