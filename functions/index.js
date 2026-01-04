/**
 * Cloud Functions - Smart Broadcast (Email + Push)
 * Gère l'envoi intelligent : Email, Push, ou les deux.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { defineSecret, defineString, defineInt } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// --- CONFIGURATION SMTP ---
const SMTP_HOST = defineString('SMTP_HOST', { default: '' });
const SMTP_SERVICE = defineString('SMTP_SERVICE', { default: '' });
const SMTP_PORT = defineInt('SMTP_PORT', { default: 587 });

const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

const MAIL_FROM_EMAIL = defineString('MAIL_FROM_EMAIL', { default: '' });
const MAIL_FROM_NAME_DEFAULT = defineString('MAIL_FROM_NAME_DEFAULT', { default: 'Lafayette' });

// --- UTILS ---
function buildTransporter() {
  const service = SMTP_SERVICE.value();
  const host = SMTP_HOST.value();
  const port = Number(SMTP_PORT.value());
  const auth = { user: SMTP_USER.value(), pass: SMTP_PASS.value() };

  if (service) return nodemailer.createTransport({ service, auth });
  if (!host) throw new HttpsError('failed-precondition', 'Missing SMTP config.');
  return nodemailer.createTransport({ host, port, secure: port === 465, auth });
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>?/gm, '').trim();
}

async function assertIsAdmin(uid) {
  const snap = await admin.database().ref(`users/${uid}/role`).once('value');
  const role = (snap.val() || '').toLowerCase();
  if (role !== 'admin' && role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Admin only.');
  }
}

// --- FONCTION PRINCIPALE ---
exports.sendSmartBroadcast = onCall(
  {
    region: 'us-central1',
    secrets: [SMTP_USER, SMTP_PASS],
    timeoutSeconds: 300,
    memory: '256MiB',
    cors: true, 
  },
  async (request) => {
    // 1. Sécurité
    if (!request.auth) throw new HttpsError('unauthenticated', 'Connexion requise.');
    await assertIsAdmin(request.auth.uid);

    // 2. Récupération des données
    const data = request.data || {};
    const { recipientIds, subject, html, fromName, channels } = data;
    
    const useEmail = channels?.email || false;
    const usePush = channels?.push || false;

    if (!recipientIds || recipientIds.length === 0) return { successCount: 0 };

    // 3. Récupération des infos utilisateurs
    const snap = await admin.database().ref('users').once('value');
    const allUsers = snap.val() || {};

    let emailTargets = new Set(); 
    let pushTokens = [];

    // 4. Logique Intelligente
    recipientIds.forEach(uid => {
      const user = allUsers[uid];
      if (!user) return;

      const userEmail = user.email;
      const userPushToken = user.fcmToken || user.pushToken || (user.fcm ? user.fcm.token : null);
      const isPushable = !!userPushToken;
      const isEmailable = (userEmail && userEmail.includes('@'));

      let willReceivePush = false;

      // Logique PUSH
      if (usePush && isPushable) {
        pushTokens.push(userPushToken);
        willReceivePush = true;
      }

      // Logique EMAIL (Si demandé OU si fallback car pas de push)
      if (isEmailable) {
        if (useEmail || (usePush && !willReceivePush)) {
          emailTargets.add(userEmail);
        }
      }
    });

    let successCount = 0;
    const errors = [];

    // 5. Envoi PUSH
    if (pushTokens.length > 0) {
      try {
        const message = {
          tokens: pushTokens,
          notification: {
            title: subject || 'Nouvelle annonce',
            body: stripHtml(html).substring(0, 140)
          },
          data: { url: '/index.html#dashboard' }
        };
        const batchResponse = await admin.messaging().sendEachForMulticast(message);
        successCount += batchResponse.successCount;
      } catch (err) {
        logger.error('Erreur Push', err);
      }
    }

    // 6. Envoi EMAILS
    if (emailTargets.size > 0) {
      try {
        const transporter = buildTransporter();
        const senderEmail = MAIL_FROM_EMAIL.value() || SMTP_USER.value();
        const senderName = fromName || MAIL_FROM_NAME_DEFAULT.value();
        
        const emailPromises = Array.from(emailTargets).map(toAddr => {
          return transporter.sendMail({
            from: `"${senderName}" <${senderEmail}>`,
            to: toAddr,
            subject: subject,
            html: html,
            text: stripHtml(html)
          }).then(() => 1).catch(() => 0);
        });

        const results = await Promise.all(emailPromises);
        successCount += results.reduce((acc, val) => acc + val, 0);

      } catch (err) {
        logger.error('Erreur Email', err);
      }
    }

    // 7. Log
    await admin.database().ref('mailLogs').push({
      date: Date.now(),
      authorUid: request.auth.uid,
      subject: subject,
      stats: { emails: emailTargets.size, pushes: pushTokens.length, success: successCount }
    });

    return { successCount, details: { emails: emailTargets.size, pushes: pushTokens.length } };
  }
);
const { onRequest } = require('firebase-functions/v2/https');

// --- WEBHOOK ALERTE EATPILOT (CORS MANUEL) ---
exports.receiveExternalAlert = onRequest(
  { region: 'us-central1' }, // On retire "cors: true" ici, on le gère en bas
  async (req, res) => {
    
    // 1. FORCER LES AUTORISATIONS (CORS)
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    // Si le navigateur demande l'autorisation (OPTIONS), on dit OUI tout de suite
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // 2. VÉRIFICATION SECRET
    if (req.query.secret !== 'SUPER_SECRET_LAFAYETTE_99') {
      return res.status(403).send('Forbidden');
    }

    const data = req.body || {};
    const subject = data.subject || 'Alerte Technique';
    const bodyHtml = data.bodyHtml || '';
    const timestamp = Date.now();

    try {
      // 3. SAUVEGARDE
      await admin.database().ref('alerts').push({
        title: subject,
        body: bodyHtml,
        date: timestamp,
        source: 'EatPilot'
      });

      // 4. NOTIFICATION PUSH
      const snap = await admin.database().ref('users').once('value');
      const users = snap.val() || {};
      const tokens = [];

      Object.values(users).forEach(u => {
        const t = u.fcmToken || u.pushToken || (u.fcm ? u.fcm.token : null);
        if (t) tokens.push(t);
      });

      if (tokens.length > 0) {
        await admin.messaging().sendEachForMulticast({
          tokens: tokens,
          notification: {
            title: '⚠️ ' + subject,
            body: 'Nouvelle alerte reçue. Voir le détail.'
          },
          data: { url: '/diffusion.html#alerts' }
        });
      }

      res.status(200).send('OK');
    } catch (e) {
      logger.error(e);
      res.status(500).send('Error');
    }
  }
);
