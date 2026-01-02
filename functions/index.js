const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

let transporter = null;

function readConfigValue(key, fallback = null) {
  if (process.env && Object.prototype.hasOwnProperty.call(process.env, key)) {
    const v = process.env[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }
  try {
    if (typeof functions.config === 'function') {
      const cfg = functions.config();
      const parts = String(key).toLowerCase().replace(/^mail_/, 'mail.').replace(/^smtp_/, 'smtp.').split('.');
      let cur = cfg;
      for (const p of parts) {
        if (!cur || typeof cur !== 'object') { cur = null; break; }
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
  return { service, host, port: Number.isFinite(port) ? port : 587, secure, user, pass, fromEmail, defaultFromName };
}

function getTransporter() {
  if (transporter) return transporter;
  const cfg = getSmtpConfig();
  const hasAuth = !!(cfg.user && cfg.pass);
  const hasServiceOrHost = !!(cfg.service || cfg.host);
  if (!hasAuth || !hasServiceOrHost || !cfg.fromEmail) return null;
  const transportOptions = cfg.service ? { service: cfg.service, auth: { user: cfg.user, pass: cfg.pass } } : { host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass } };
  transporter = nodemailer.createTransport(transportOptions);
  return transporter;
}

function stripHtml(input) { return String(input || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
function normalizeEmail(e) { const s = String(e || '').trim(); return s ? s.toLowerCase() : ''; }
function uniqEmails(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    const em = normalizeEmail(raw);
    if (!em) continue;
    if (!seen.has(em)) { seen.add(em); out.push(em); }
  }
  return out;
}

async function sendEmailBatches({ recipients, subject, html, fromName }) {
  const cfg = getSmtpConfig();
  const t = getTransporter();
  if (!t) throw new functions.https.HttpsError('failed-precondition', 'Configuration SMTP manquante.');
  const fromLabel = (fromName && String(fromName).trim()) || cfg.defaultFromName || '';
  const from = fromLabel ? `${fromLabel} <${cfg.fromEmail}>` : cfg.fromEmail;
  const BATCH_SIZE = 40;
  let sent = 0, batches = 0;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    batches += 1;
    await t.sendMail({ from, to: cfg.fromEmail, bcc: batch, subject: String(subject || ''), html: String(html || '') });
    sent += batch.length;
  }
  return { sent, batches };
}

exports.sendBulkEmail = functions.https.onCall(async (data, context) => {
  console.log('🧪 AUTH DEBUG:', {
    hasAuth: !!context.auth,
    uid: context.auth?.uid || 'NULL',
    email: context.auth?.token?.email || 'NO_EMAIL'
  });

  const uid = context.auth?.uid;
  if (!uid) {
    console.error('❌ NO UID IN CONTEXT.AUTH');
    throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
  }

  const userSnapshot = await admin.database().ref('users/' + uid).once('value');
  const user = userSnapshot.val();
  
  console.log('🧪 USER DEBUG:', {
    uid,
    userExists: !!user,
    userRole: user?.role || 'NO_ROLE',
    userRoleType: typeof user?.role,
    fullUser: user
  });

  const role = (user && user.role ? String(user.role).toLowerCase().trim() : '');

  console.log('🧪 ROLE CHECK:', {
    rawRole: user?.role,
    processedRole: role,
    isAdmin: role === 'admin',
    isSuperAdmin: role === 'superadmin',
    passes: role === 'admin' || role === 'superadmin'
  });

  if (role !== 'admin' && role !== 'superadmin') {
    console.error('❌ PERMISSION DENIED:', { role });
    throw new functions.https.HttpsError('permission-denied', 'Admin requis');
  }

  const payload = data || {};
  const recipients = uniqEmails(Array.isArray(payload.recipients) ? payload.recipients : []);
  const subject = String(payload.subject || '').trim();
  const html = String(payload.html || '').trim();
  const channel = String(payload.channel || 'email').toLowerCase();

  if (!recipients.length) throw new functions.https.HttpsError('invalid-argument', 'Recipients requis');
  if (!subject) throw new functions.https.HttpsError('invalid-argument', 'Sujet requis');
  if (!html) throw new functions.https.HttpsError('invalid-argument', 'Message requis');
  if (!['email', 'push', 'both'].includes(channel)) throw new functions.https.HttpsError('invalid-argument', 'Canal invalide');

  console.log('✅ EMAIL SEND:', { recipients: recipients.length, subject, channel });

  const res = await sendEmailBatches({ recipients, subject, html, fromName: payload.fromName });
  
  await admin.database().ref('logs/diffusion').push({ 
    timestamp: Date.now(), 
    userId: uid, 
    channel, 
    recipientCount: recipients.length, 
    subject,
    sent: res.sent
  });

  return { success: true, sent: res.sent, total: recipients.length };
});
