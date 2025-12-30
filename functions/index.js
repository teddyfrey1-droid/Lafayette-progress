const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// ✅ TOUT en secrets pour simplifier
const SMTP_HOST = defineSecret('SMTP_HOST');
const SMTP_PORT = defineSecret('SMTP_PORT');
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');
const MAIL_FROM_EMAIL = defineSecret('MAIL_FROM_EMAIL');
const MAIL_FROM_NAME_DEFAULT = defineSecret('MAIL_FROM_NAME_DEFAULT');

function buildTransporter() {
  const host = process.env.SMTP_HOST; // ✅ Accès via process.env
  const port = Number(process.env.SMTP_PORT || 587);
  const auth = {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  };

  if (!host) {
    throw new HttpsError('failed-precondition', 'Missing SMTP_HOST configuration.');
  }

  const secure = port === 465;
  return nodemailer.createTransport({ host, port, secure, auth });
}

function buildFromHeader(fromName) {
  const name = fromName || process.env.MAIL_FROM_NAME_DEFAULT || 'Lafayette';
  const email = process.env.MAIL_FROM_EMAIL;
  return `${name} <${email}>`;
}

async function assertIsAdmin(uid) {
  const snap = await admin.database().ref(`users/${uid}`).once('value');
  const u = snap.val();
  if (!u || u.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin only.');
  }
  return u;
}

exports.sendBulkEmail = onCall(
  {
    region: 'us-central1',
    // ✅ Bind TOUS les secrets
    secrets: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM_EMAIL, MAIL_FROM_NAME_DEFAULT],
    cors: true,
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }

    await assertIsAdmin(request.auth.uid);

    const { recipients, subject, html, fromName } = request.data;

    if (!recipients?.length) {
      throw new HttpsError('invalid-argument', 'Recipients required.');
    }
    if (!subject) {
      throw new HttpsError('invalid-argument', 'Subject required.');
    }
    if (!html) {
      throw new HttpsError('invalid-argument', 'Message required.');
    }

    const transporter = buildTransporter();
    const from = buildFromHeader(fromName);

    await transporter.sendMail({
      from,
      bcc: recipients,
      subject,
      html,
    });

    logger.info('Bulk email sent', { count: recipients.length });
    return { sent: recipients.length };
  }
);
