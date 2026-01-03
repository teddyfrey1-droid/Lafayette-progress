/**
 * Cloud Functions - Email sender for Lafayette-progress
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { defineSecret, defineString, defineInt } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Configuration des paramètres (variables d'environnement)
const SMTP_HOST = defineString('SMTP_HOST', { default: '' });
const SMTP_SERVICE = defineString('SMTP_SERVICE', { default: '' });
const SMTP_PORT = defineInt('SMTP_PORT', { default: 587 });

// Secrets (mots de passe stockés de manière sécurisée dans Firebase)
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

const MAIL_FROM_EMAIL = defineString('MAIL_FROM_EMAIL', { default: '' });
const MAIL_FROM_NAME_DEFAULT = defineString('MAIL_FROM_NAME_DEFAULT', { default: 'Lafayette-progress' });

// Vérifie si une chaîne ressemble à un email
function isProbablyEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Nettoie le HTML pour créer une version texte simple
function stripHtmlToText(html) {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/?p\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Vérifie que l'utilisateur qui appelle la fonction est bien Admin
async function assertIsAdmin(uid) {
  const snap = await admin.database().ref(`users/${uid}`).once('value');
  const u = snap.val();
  const role = (u && u.role) ? String(u.role).toLowerCase() : '';
  if (role !== 'admin' && role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Admin only.');
  }
  return u;
}

// Configure le transporteur d'emails (Nodemailer)
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
  
  if (!email || !isProbablyEmail(email)) {
     return name; 
  }
  return `${name} <${email}>`;
}

// --- LA FONCTION PRINCIPALE APPELÉE PAR LE SITE ---
exports.sendBulkEmail = onCall(
  {
    region: 'us-central1', // Vérifiez si vous êtes en us-central1 ou europe-west1
    secrets: [SMTP_USER, SMTP_PASS],
    cors: true,
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (request) => {
    // 1. Authentification requise
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }

    // 2. Vérification Admin
    const actor = await assertIsAdmin(request.auth.uid);

    // 3. Récupération des données envoyées par le site
    const data = request.data || {};
    const recipients = Array.isArray(data.recipients) ? data.recipients : [];
    const subject = typeof data.subject === 'string' ? data.subject.trim() : '';
    const html = typeof data.html === 'string' ? data.html.trim() : '';
    const fromName = typeof data.fromName === 'string' ? data.fromName.trim() : '';
    const replyTo = typeof data.replyTo === 'string' ? data.replyTo.trim() : '';

    // Nettoyage des emails
    const cleanRecipients = [...new Set(recipients.map(String).map(s => s.trim()))]
      .filter(isProbablyEmail);

    if (cleanRecipients.length === 0) {
      throw new HttpsError('invalid-argument', 'At least one recipient email is required.');
    }
    if (cleanRecipients.length > 50) {
      throw new HttpsError('invalid-argument', 'Max 50 recipients per request.');
    }
    if (!subject) throw new HttpsError('invalid-argument', 'Subject is required.');
    if (!html) throw new HttpsError('invalid-argument', 'Message is required.');

    // 4. Préparation de l'envoi
    const transporter = buildTransporter();
    const from = buildFromHeader(fromName, null);
    const messageText = stripHtmlToText(html);

    // 5. Boucle d'envoi
    let sent = 0;
    for (const to of cleanRecipients) {
      try {
        await transporter.sendMail({
          from,
          to,
          subject,
          html,
          text: messageText,
          replyTo: isProbablyEmail(replyTo) ? replyTo : undefined,
        });
        sent += 1;
      } catch (err) {
        logger.error(`Failed to send to ${to}`, err);
      }
    }

    // 6. Enregistrement dans les logs Firebase (optionnel)
    const logRef = admin.database().ref('mailLogs').push();
    await logRef.set({
      createdAt: Date.now(),
      actorUid: request.auth.uid,
      actorEmail: actor && actor.email ? String(actor.email) : null,
      subject,
      recipientsCount: cleanRecipients.length,
      sentCount: sent
    });

    return { success: true, sent };
  }
);
