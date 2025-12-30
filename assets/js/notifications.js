/**
 * Cloud Functions - Email sender for Lafayette-progress
 *
 * Exports:
 *  - sendBulkEmail (callable)
 *
 * Required environment / params:
 *  - SMTP_HOST (string) or SMTP_SERVICE (string)
 *  - SMTP_PORT (int, default 587)
 *  - SMTP_USER (secret)
 *  - SMTP_PASS (secret)
 *  - MAIL_FROM_EMAIL (string) e.g. "heiko@lafayette.fr"
 *  - MAIL_FROM_NAME_DEFAULT (string, optional) e.g. "Heiko La Fayette"
 */

const admin = require('firebase-admin');
admin.initializeApp();

const nodemailer = require('nodemailer');

// Firebase Functions v2
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { defineSecret, defineString, defineInt } = require('firebase-functions/params');

// Optional: load local .env when running via emulator
try {
  require('dotenv').config();
} catch (_) {}

// Params (can come from .env for local dev, or from Firebase CLI prompts)
const SMTP_HOST = defineString('SMTP_HOST', { default: '' });
const SMTP_SERVICE = defineString('SMTP_SERVICE', { default: '' });
const SMTP_PORT = defineInt('SMTP_PORT', { default: 587 });

// Use Secret Manager-backed params for credentials
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

const MAIL_FROM_EMAIL = defineString('MAIL_FROM_EMAIL', { default: '' });
const MAIL_FROM_NAME_DEFAULT = defineString('MAIL_FROM_NAME_DEFAULT', { default: 'Lafayette-progress' });

function isProbablyEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function stripHtmlToText(html) {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/?p\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function assertIsAdmin(uid) {
  const snap = await admin.database().ref(`users/${uid}`).once('value');
  const u = snap.val();
  const role = (u && u.role) ? String(u.role).toLowerCase() : '';
  if (role !== 'admin' && role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Admin only.');
  }
  return u;
}

function buildTransporter() {
  const service = SMTP_SERVICE.value();
  const host = SMTP_HOST.value();
  const port = Number(SMTP_PORT.value());

  const auth = {
    user: SMTP_USER.value(),
    pass: SMTP_PASS.value(),
  };

  if (service) {
    return nodemailer.createTransport({ service, auth });
  }

  if (!host) {
    throw new HttpsError(
      'failed-precondition',
      'Missing SMTP_HOST or SMTP_SERVICE configuration.'
    );
  }

  const secure = port === 465;
  return nodemailer.createTransport({ host, port, secure, auth });
}

function buildFromHeader(fromName, fromEmail) {
  const name = (fromName && String(fromName).trim()) || MAIL_FROM_NAME_DEFAULT.value();
  const email = (fromEmail && String(fromEmail).trim()) || MAIL_FROM_EMAIL.value();
  if (!isProbablyEmail(email)) {
    throw new HttpsError('failed-precondition', 'MAIL_FROM_EMAIL is missing or invalid.');
  }
  return `${name} <${email}>`;
}

exports.sendBulkEmail = onCall(
  {
    // Default region (frontend can set settings/functionsRegion accordingly)
    region: 'us-central1',
    secrets: [SMTP_USER, SMTP_PASS],
    cors: true,
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }

    const actor = await assertIsAdmin(request.auth.uid);

    const data = request.data || {};
    const recipients = Array.isArray(data.recipients) ? data.recipients : [];
    const subject = typeof data.subject === 'string' ? data.subject.trim() : '';
    const html = typeof data.html === 'string' ? data.html.trim() : '';

    const fromName = typeof data.fromName === 'string' ? data.fromName.trim() : '';
    const replyTo = typeof data.replyTo === 'string' ? data.replyTo.trim() : '';

    const cleanRecipients = [...new Set(recipients.map(String).map(s => s.trim()))]
      .filter(isProbablyEmail);

    if (cleanRecipients.length === 0) {
      throw new HttpsError('invalid-argument', 'At least one recipient email is required.');
    }
    if (cleanRecipients.length > 50) {
      throw new HttpsError('invalid-argument', 'Max 50 recipients per request.');
    }
    if (!subject) {
      throw new HttpsError('invalid-argument', 'Subject is required.');
    }
    if (!html) {
      throw new HttpsError('invalid-argument', 'Message is required.');
    }

    const transporter = buildTransporter();
    const from = buildFromHeader(fromName, null);

    const messageText = stripHtmlToText(html);

    // Log (without storing full email body)
    const logRef = admin.database().ref('mailLogs').push();
    await logRef.set({
      createdAt: Date.now(),
      actorUid: request.auth.uid,
      actorEmail: actor && actor.email ? String(actor.email) : null,
      subject,
      recipientsCount: cleanRecipients.length,
    });

    let sent = 0;
    for (const to of cleanRecipients) {
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text: messageText,
        replyTo: isProbablyEmail(replyTo) ? replyTo : undefined,
      });
      sent += 1;
    }

    logger.info('Bulk email sent', {
      actorUid: request.auth.uid,
      recipientsCount: cleanRecipients.length,
      subject,
    });

    return { success: true, sent };
  }
);


/**
 * Example (disabled): automatic email when a planning item is created.
 *
 * IMPORTANT: you must adapt the RTDB path + schema to your planning structure.
 *
 * // const { onValueCreated } = require('firebase-functions/v2/database');
 * // exports.onPlanningCreated = onValueCreated(
 * //   { ref: '/planning/{eventId}', region: 'us-central1', secrets: [SMTP_USER, SMTP_PASS] },
 * //   async (event) => {
 * //     const planning = event.data.val();
 * //     const userId = planning && planning.userId;
 * //     if (!userId) return;
 * //
 * //     const userSnap = await admin.database().ref(`users/${userId}`).once('value');
 * //     const user = userSnap.val();
 * //     if (!user || !user.email) return;
 * //
 * //     const transporter = buildTransporter();
 * //     await transporter.sendMail({
 * //       from: buildFromHeader(null, null),
 * //       to: String(user.email),
 * //       subject: 'Nouveau planning',
 * //       text: 'Tu as été ajouté au planning.',
 * //     });
 * //   }
 * // );
 */
