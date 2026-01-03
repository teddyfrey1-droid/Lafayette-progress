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
// ============================================================
// WEBHOOK POUR ALERTES EXTERNES (EatPilot -> App)
// ============================================================
const { onRequest } = require("firebase-functions/v2/https");

exports.receiveExternalAlert = onRequest(
  { cors: true, region: 'us-central1' }, // ou 'europe-west1' selon ton projet
  async (req, res) => {
    // 1. Sécurité simple (Mot de passe dans l'URL)
    const secret = req.query.secret;
    if (secret !== "SUPER_SECRET_LAFAYETTE_99") {
      return res.status(403).send("Accès refusé.");
    }

    // 2. Récupérer le contenu envoyé par Gmail
    const { subject, bodyHtml } = req.body;

    if (!subject || !bodyHtml) return res.status(400).send("Données manquantes");

    try {
      // 3. Récupérer toute l'équipe active
      const snap = await admin.database().ref('users').once('value');
      const allUsers = snap.val() || {};
      
      const recipientIds = Object.keys(allUsers).filter(uid => {
          // On envoie à tous les comptes actifs
          return allUsers[uid].status === 'active';
      });

      if (recipientIds.length === 0) return res.send("Aucun destinataire.");

      // 4. Préparer les tokens Push et Emails
      let pushTokens = [];
      let emailTargets = new Set();

      recipientIds.forEach(uid => {
          const u = allUsers[uid];
          // PUSH
          const token = u.fcmToken || u.pushToken || (u.fcm ? u.fcm.token : null);
          if (token) pushTokens.push(token);
          // EMAIL
          if (u.email && u.email.includes('@')) emailTargets.add(u.email);
      });

      // 5. Envoyer le PUSH
      if (pushTokens.length > 0) {
          await admin.messaging().sendEachForMulticast({
              tokens: pushTokens,
              notification: {
                  title: "🚨 ALERTE FRIGO / TEMPÉRATURE",
                  body: subject.replace("[EatPilot]", "").trim(), // On nettoie un peu le titre
              },
              data: { url: '/index.html#dashboard', type: 'alert' }
          });
      }

      // 6. Envoyer les EMAILS (via Nodemailer configuré plus haut)
      // On réutilise ta fonction buildTransporter() existante dans ce fichier
      if (emailTargets.size > 0) {
          const transporter = buildTransporter(); // Utilise la fonction définie au début du fichier
          const senderEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;
          
          // On envoie en copie cachée (BCC) pour pas que tout le monde voit les emails
          await transporter.sendMail({
              from: `"Alerte Heiko" <${senderEmail}>`,
              bcc: Array.from(emailTargets), // Envoi groupé caché
              subject: "🚨 " + subject,
              html: `
                <div style="background:#fee2e2; padding:20px; border-radius:10px; font-family:sans-serif; color:#991b1b;">
                   <h2 style="margin-top:0;">⚠️ ALERTE TEMPÉRATURE</h2>
                   <p>Une alerte critique a été reçue d'EatPilot :</p>
                   <div style="background:white; padding:15px; border-radius:8px; border:1px solid #fca5a5; color:#333;">
                      ${bodyHtml}
                   </div>
                   <p style="font-weight:bold; margin-top:20px;">Merci de vérifier sur place immédiatement.</p>
                </div>
              `
          });
      }

      // Log dans l'historique
      await admin.database().ref('logs').push({
          user: "Système EatPilot",
          action: "Alerte Température",
          detail: subject,
          type: "alert",
          time: Date.now()
      });

      res.status(200).send("Alerte diffusée avec succès !");

    } catch (error) {
      console.error("Erreur Webhook:", error);
      res.status(500).send("Erreur serveur: " + error.message);
    }
  }
);
