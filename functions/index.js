const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// SMTP helpers (lazy init)
let transporter = null;

function readConfigValue(key, fallback = null) {
  if (process.env && Object.prototype.hasOwnProperty.call(process.env, key)) {
    const v = process.env[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }

  try {
    if (typeof functions.config === 'function') {
      const cfg = functions.config();
      const parts = String(key)
        .toLowerCase()
        .replace(/^mail_/, 'mail.')
        .replace(/^smtp_/, 'smtp.')
        .split('.');
      let cur = cfg;
      for (const p of parts) {
        if (!cur || typeof cur !== 'object') {
          cur = null;
          break;
        }
        cur = cur[p];
      }
      if (cur !== undefined && cur !== null && String(cur).trim() !== '') return String(cur);
    }
  } catch (_) {}

  return fallback;
}

function getSmtpConfig() {
  const service = readConfigValue('SMTP_SERVICE', '');
  const host = readConfigValue('SMTP_HOST', '');
  const portRaw = readConfigValue('SMTP_PORT', '587');
  const user = readConfigValue('SMTP_USER', '');
  const pass = readConfigValue('SMTP_PASS', '');
  const fromEmail = readConfigValue('MAIL_FROM_EMAIL', '') || user;
  const defaultFromName = readConfigValue('MAIL_FROM_NAME_DEFAULT', '');

  const port = Number.parseInt(String(portRaw), 10);
  const secureFlag = String(readConfigValue('SMTP_SECURE', '') || '').toLowerCase() === 'true';
  const secure = secureFlag || port === 465;

  return {
    service,
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    user,
    pass,
    fromEmail,
    defaultFromName,
  };
}

function getTransporter() {
  if (transporter) return transporter;

  const cfg = getSmtpConfig();

  const hasAuth = !!(cfg.user && cfg.pass);
  const hasServiceOrHost = !!(cfg.service || cfg.host);

  if (!hasAuth || !hasServiceOrHost || !cfg.fromEmail) {
    return null;
  }

  const transportOptions = cfg.service
    ? { service: cfg.service, auth: { user: cfg.user, pass: cfg.pass } }
    : {
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
      };

  transporter = nodemailer.createTransport(transportOptions);
  return transporter;
}

function stripHtml(input) {
  return String(input || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeEmail(e) {
  const s = String(e || '').trim();
  if (!s) return '';
  return s.toLowerCase();
}

function uniqEmails(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    const em = normalizeEmail(raw);
    if (!em) continue;
    if (!seen.has(em)) {
      seen.add(em);
      out.push(em);
    }
  }
  return out;
}

async function sendEmailBatches({ recipients, subject, html, fromName }) {
  const cfg = getSmtpConfig();
  const t = getTransporter();

  if (!t) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Configuration SMTP manquante (variables SMTP_* / MAIL_*).'
    );
  }

  const fromLabel = (fromName && String(fromName).trim()) || cfg.defaultFromName || '';
  const from = fromLabel ? `${fromLabel} <${cfg.fromEmail}>` : cfg.fromEmail;

  const BATCH_SIZE = 40;
  let sent = 0;
  let batches = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    batches += 1;

    await t.sendMail({
      from,
      to: cfg.fromEmail,
      bcc: batch,
      subject: String(subject || ''),
      html: String(html || ''),
    });

    sent += batch.length;
  }

  return { sent, batches };
}

// Callable: sendBulkEmail
exports.sendBulkEmail = functions.https.onCall(async (data, context) => {
  console.log('🧪 DEBUG sendBulkEmail:', {
    hasAuth: !!context.auth,
    uid: context.auth?.uid || 'NULL',
    email: context.auth?.token?.email || 'NO_EMAIL'
  });

  // TEMPORAIRE : Commenté pour test
  // if (!context.auth) {
  //   throw new functions.https.HttpsError('unauthenticated', 'Authentification requise');
  // }

  const userSnapshot = await admin.database().ref('users/' + (context.auth?.uid || 'anonymous')).once('value');
  const user = userSnapshot.val();
  const role = (user && user.role ? String(user.role).toLowerCase() : '');

  if (role !== 'admin' && role !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'Accès admin requis');
  }

  const payload = data || {};
  const recipientsRaw = Array.isArray(payload.recipients) ? payload.recipients : [];
  const recipients = uniqEmails(recipientsRaw);
  const subject = String(payload.subject || '').trim();
  const html = String(payload.html || '').trim();
  const channel = String(payload.channel || 'email').toLowerCase();
  const fallbackToEmail = payload.fallbackToEmail !== false;
  const fromName = payload.fromName ? String(payload.fromName) : null;

  if (!recipients || recipients.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Recipients requis');
  }
  if (!subject) {
    throw new functions.https.HttpsError('invalid-argument', 'Sujet requis');
  }
  if (!html) {
    throw new functions.https.HttpsError('invalid-argument', 'Message requis');
  }
  if (!['email', 'push', 'both'].includes(channel)) {
    throw new functions.https.HttpsError('invalid-argument', 'Canal invalide');
  }

  console.log('sendBulkEmail:', { channel, recipients: recipients.length, fallbackToEmail });

  const usersSnapshot = await admin.database().ref('users').once('value');
  const allUsers = usersSnapshot.val() || {};

  const emailToToken = new Map();
  for (const uid of Object.keys(allUsers)) {
    const u = allUsers[uid] || {};
    if (u.email) {
      const em = normalizeEmail(u.email);
      if (em && u.fcmToken && String(u.fcmToken).trim()) {
        emailToToken.set(em, String(u.fcmToken).trim());
      }
    }
  }

  let emailSent = 0;
  let emailBatches = 0;
  let pushSent = 0;
  let pushFailureCount = 0;

  const needsPush = (channel === 'push' || channel === 'both');
  const tokens = [];
  const emailsWithoutPush = [];

  if (needsPush) {
    for (const em of recipients) {
      const tok = emailToToken.get(em);
      if (tok) tokens.push(tok);
      else emailsWithoutPush.push(em);
    }

    if (tokens.length > 0) {
      try {
        const resp = await admin.messaging().sendMulticast({
          notification: {
            title: subject,
            body: stripHtml(html).substring(0, 120),
          },
          tokens,
        });

        pushSent = resp.successCount || 0;
        pushFailureCount = resp.failureCount || 0;
        console.log('Push:', { success: pushSent, failure: pushFailureCount });
      } catch (err) {
        console.error('Erreur push:', err);
      }
    }
  }

  const needsEmailDirect = (channel === 'email' || channel === 'both');
  const needsEmailFallback = (channel === 'push' && fallbackToEmail && emailsWithoutPush.length > 0);

  if (needsEmailDirect || needsEmailFallback) {
    const targetEmails = needsEmailDirect ? recipients : emailsWithoutPush;
    const res = await sendEmailBatches({
      recipients: targetEmails,
      subject,
      html,
      fromName,
    });
    emailSent = res.sent;
    emailBatches = res.batches;
    console.log('Email:', { sent: emailSent, batches: emailBatches });
  }

  await admin.database().ref('logs/diffusion').push({
    timestamp: Date.now(),
    userId: context.auth?.uid || 'anonymous',
    channel,
    recipientCount: recipients.length,
    subject,
    breakdown: {
      emailSent,
      emailBatches,
      pushSent,
      pushFailureCount,
    },
  });

  return {
    success: true,
    sent: emailSent + pushSent,
    total: recipients.length,
    breakdown: {
      emailSent,
      emailBatches,
      pushSent,
      pushFailureCount,
    },
  };
});
