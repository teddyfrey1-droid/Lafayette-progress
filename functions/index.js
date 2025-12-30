const admin = require('firebase-admin');
admin.initializeApp();

const nodemailer = require('nodemailer');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');

// ✅ Tous les secrets
const SMTP_HOST = defineSecret('SMTP_HOST');
const SMTP_PORT = defineSecret('SMTP_PORT');
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');
const MAIL_FROM_EMAIL = defineSecret('MAIL_FROM_EMAIL');
const MAIL_FROM_NAME_DEFAULT = defineSecret('MAIL_FROM_NAME_DEFAULT');

async function assertIsAdmin(uid) {
  const snap = await admin.database().ref(`users/${uid}`).once('value');
  const u = snap.val();
  if (!u || u.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin only.');
  }
  return u;
}

function buildTransporter() {
  const host = process.env.SMTP_HOST;
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

exports.sendBulkEmail = onCall(
  {
    region: 'us-central1',
    secrets: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM_EMAIL, MAIL_FROM_NAME_DEFAULT],
    cors: true,
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }

    const actor = await assertIsAdmin(request.auth.uid);
    const { recipients, subject, html, fromName } = request.data || {};

    if (!recipients || recipients.length === 0) {
      throw new HttpsError('invalid-argument', 'Recipients required.');
    }
    if (!subject) {
      throw new HttpsError('invalid-argument', 'Subject required.');
    }
    if (!html) {
      throw new HttpsError('invalid-argument', 'Message required.');
    }

    const transporter = buildTransporter();
    const from = `${fromName || process.env.MAIL_FROM_NAME_DEFAULT} <${process.env.MAIL_FROM_EMAIL}>`;

    await transporter.sendMail({
      from,
      bcc: recipients,
      subject,
      html,
    });

    logger.info('Bulk email sent', { count: recipients.length, actor: actor.email });
    return { sent: recipients.length };
  }
);


