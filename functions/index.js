/**
 * Cloud Functions - Smart Broadcast (Email + Push)
 * Gère l'envoi intelligent : Email, Push, ou Fallback (Push -> Email si pas de token)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { defineSecret, defineString, defineInt } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// --- CONFIGURATION SMTP (Paramètres & Secrets) ---
// Ces valeurs sont définies via la commande 'firebase deploy' ou le fichier .env
const SMTP_HOST = defineString('SMTP_HOST', { default: '' });
const SMTP_SERVICE = defineString('SMTP_SERVICE', { default: '' });
const SMTP_PORT = defineInt('SMTP_PORT', { default: 587 });

const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

const MAIL_FROM_EMAIL = defineString('MAIL_FROM_EMAIL', { default: '' });
const MAIL_FROM_NAME_DEFAULT = defineString('MAIL_FROM_NAME_DEFAULT', { default: 'Lafayette' });

// --- UTILITAIRES ---

// Crée le transporteur d'emails
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
    throw new HttpsError('failed-precondition', 'Configuration SMTP manquante (HOST ou SERVICE).');
  }

  // Port 465 = Sécurisé (SSL), sinon 587 (TLS)
  const secure = port === 465;
  return nodemailer.createTransport({ host, port, secure, auth });
}

// Nettoie le HTML pour faire une version texte simple (pour les previews)
function stripHtml(html) {
  return (html || '').replace(/<[^>]*>?/gm, '').trim();
}

// Vérifie que l'utilisateur est admin
async function assertIsAdmin(uid) {
  const snap = await admin.database().ref(`users/${uid}/role`).once('value');
  const role = (snap.val() || '').toLowerCase();
  if (role !== 'admin' && role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Réservé aux administrateurs.');
  }
}

// --- FONCTION PRINCIPALE ---

exports.sendSmartBroadcast = onCall(
  {
    region: 'us-central1', // Modifiez si vous utilisez europe-west1
    secrets: [SMTP_USER, SMTP_PASS],
    timeoutSeconds: 300, // 5 minutes max pour les gros envois
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
    
    // Canaux demandés
    const useEmail = channels?.email || false;
    const usePush = channels?.push || false;

    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return { successCount: 0, message: "Aucun destinataire." };
    }

    // 3. Récupération des infos utilisateurs (Email + Tokens)
    // On charge tout 'users' pour faire le tri. Pour >2000 users, il faudrait optimiser.
    const snap = await admin.database().ref('users').once('value');
    const allUsers = snap.val() || {};

    // Listes de diffusion finales
    let emailTargets = new Set(); // Set pour éviter les doublons
    let pushTokens = [];

    // 4. Logique Intelligente (Le Cerveau) 🧠
    recipientIds.forEach(uid => {
      const user = allUsers[uid];
      if (!user) return;

      const userEmail = user.email;
      // On cherche le token à plusieurs endroits possibles
      const userPushToken = user.fcmToken || user.pushToken || (user.fcm ? user.fcm.token : null);
      const isPushable = !!userPushToken;
      const isEmailable = (userEmail && userEmail.includes('@'));

      let willReceivePush = false;

      // A) Si on veut du Push et que l'user a un token -> On ajoute à la liste Push
      if (usePush && isPushable) {
        pushTokens.push(userPushToken);
        willReceivePush = true;
      }

      // B) Logique Email :
      //    - Si on a coché "Email" -> On envoie.
      //    - OU SI on a coché "Push" MAIS que l'user n'a pas de token (Fallback) -> On envoie un email à la place.
      if (isEmailable) {
        if (useEmail || (usePush && !willReceivePush)) {
          emailTargets.add(userEmail);
        }
      }
    });

    let successCount = 0;
    const errors = [];

    // 5. Envoi des PUSH (rapide, en lot)
    if (pushTokens.length > 0) {
      try {
        const message = {
          tokens: pushTokens, // Envoi groupé (Multicast)
          notification: {
            title: subject || 'Nouvelle annonce',
            body: stripHtml(html).substring(0, 140) // Texte court pour la notif
          },
          data: {
            url: '/index.html#dashboard', // Clic -> Dashboard
            type: 'broadcast'
          }
        };

        const batchResponse = await admin.messaging().sendEachForMulticast(message);
        successCount += batchResponse.successCount;
        
        if (batchResponse.failureCount > 0) {
          logger.warn(`Push partiel : ${batchResponse.failureCount} échecs sur ${pushTokens.length}.`);
        }
      } catch (err) {
        logger.error('Erreur Push Global', err);
        errors.push("Push: " + err.message);
      }
    }

    // 6. Envoi des EMAILS
    if (emailTargets.size > 0) {
      try {
        const transporter = buildTransporter();
        const senderEmail = MAIL_FROM_EMAIL.value() || SMTP_USER.value(); // Fallback
        const senderName = fromName || MAIL_FROM_NAME_DEFAULT.value();
        
        const finalFrom = `"${senderName}" <${senderEmail}>`;
        const textVersion = stripHtml(html);

        // Envoi en boucle (pour éviter que tout le monde voie les emails des autres en 'to')
        const emailPromises = Array.from(emailTargets).map(toAddr => {
          return transporter.sendMail({
            from: finalFrom,
            to: toAddr,
            subject: subject,
            html: html,
            text: textVersion
          })
          .then(() => 1) // Succès = +1
          .catch(err => {
            logger.error(`Echec email vers ${toAddr}`, err);
            return 0; // Echec = +0
          });
        });

        // Attendre que tous les emails soient traités
        const results = await Promise.all(emailPromises);
        const emailSuccess = results.reduce((acc, val) => acc + val, 0);
        successCount += emailSuccess;

      } catch (err) {
        logger.error('Erreur Email Global', err);
        errors.push("Email: " + err.message);
      }
    }

    // 7. Audit Log (Historique)
    try {
      await admin.database().ref('mailLogs').push({
        date: Date.now(),
        authorUid: request.auth.uid,
        subject: subject,
        stats: {
          requested: recipientIds.length,
          emailsSent: emailTargets.size,
          pushesSent: pushTokens.length,
          totalSuccess: successCount
        }
      });
    } catch(e) { /* ignore log error */ }

    return { 
      successCount, 
      failureCount: errors.length,
      details: { emails: emailTargets.size, pushes: pushTokens.length }
    };
  }
);
