// ═══════════════════════════════════════════════════════════════════════
// FIREBASE CLOUD FUNCTIONS - HEIKO LAFAYETTE
// ═══════════════════════════════════════════════════════════════════════

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURATION EMAIL (GMAIL)
// ═══════════════════════════════════════════════════════════════════════

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'lafayetteheiko@gmail.com',  // ← TON EMAIL GMAIL
    pass: 'eanysmkipkvvcwgu'  // ← MOT DE PASSE APPLICATION (pas ton mdp Gmail normal)
  }
});

// Pour créer un mot de passe d'application Gmail :
// 1. Va sur https://myaccount.google.com/security
// 2. Active la validation en 2 étapes
// 3. Va dans "Mots de passe des applications"
// 4. Crée un mot de passe pour "Mail"
// 5. Copie le mot de passe généré ici

// ═══════════════════════════════════════════════════════════════════════
// FONCTION : ENVOI BULK EMAIL (pour l'onglet Diffusion)
// ═══════════════════════════════════════════════════════════════════════

exports.sendBulkEmail = functions.https.onCall(async (data, context) => {
  // Sécurité : Vérifier que l'utilisateur est authentifié
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
  }

  const { recipients, subject, html, fromName } = data;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'recipients requis');
  }

  if (!subject || !html) {
    throw new functions.https.HttpsError('invalid-argument', 'subject et html requis');
  }

  const results = { sent: 0, failed: 0, errors: [] };

  // Envoyer à chaque destinataire
  for (const email of recipients) {
    try {
      await transporter.sendMail({
        from: fromName ? `"${fromName}" <lafayetteheiko@gmail.com>` : '"Heiko Lafayette" <lafayetteheiko@gmail.com>',
        to: email,
        subject: subject,
        html: html
      });

      results.sent++;
      console.log(`✅ Email envoyé à: ${email}`);
    } catch (error) {
      results.failed++;
      results.errors.push({ email, error: error.message });
      console.error(`❌ Erreur envoi à ${email}:`, error.message);
    }
  }

  return results;
});

// ═══════════════════════════════════════════════════════════════════════
// FONCTION : ENVOYER UN EMAIL À PLUSIEURS UTILISATEURS
// ═══════════════════════════════════════════════════════════════════════

exports.sendEmailToUsers = functions.https.onCall(async (data, context) => {
  // Sécurité : Vérifier que l'utilisateur est authentifié
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
  }

  const { userIds, subject, html, text } = data;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'userIds requis');
  }

  if (!subject || !html) {
    throw new functions.https.HttpsError('invalid-argument', 'subject et html requis');
  }

  const db = admin.database();
  const results = { sent: 0, failed: 0, errors: [] };

  for (const uid of userIds) {
    try {
      const userSnap = await db.ref(`users/${uid}`).once('value');
      const user = userSnap.val();

      if (!user || !user.email) {
        results.failed++;
        results.errors.push({ uid, error: 'Email manquant' });
        continue;
      }

      await transporter.sendMail({
        from: '"Heiko Lafayette" <lafayetteheiko@gmail.com>',
        to: user.email,
        subject: subject,
        text: text || '',
        html: html
      });

      results.sent++;
    } catch (error) {
      results.failed++;
      results.errors.push({ uid, error: error.message });
    }
  }

  return results;
});

// ═══════════════════════════════════════════════════════════════════════
// FONCTION : ENVOYER UNE NOTIFICATION PUSH À PLUSIEURS UTILISATEURS
// ═══════════════════════════════════════════════════════════════════════

exports.sendPushToUsers = functions.https.onCall(async (data, context) => {
  // Sécurité : Vérifier que l'utilisateur est authentifié
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
  }

  const { userIds, title, body, link } = data;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'userIds requis');
  }

  if (!title || !body) {
    throw new functions.https.HttpsError('invalid-argument', 'title et body requis');
  }

  const db = admin.database();
  const results = { sent: 0, failed: 0, noToken: 0, errors: [] };

  // Récupérer les tokens de tous les utilisateurs
  const tokens = [];
  const usersWithoutToken = [];

  for (const uid of userIds) {
    try {
      const userSnap = await db.ref(`users/${uid}`).once('value');
      const user = userSnap.val();

      if (!user) {
        results.failed++;
        continue;
      }

      // Vérifier si l'utilisateur a un token et les notifications activées
      if (user.pushToken && user.pushEnabled === true) {
        tokens.push(user.pushToken);
      } else {
        usersWithoutToken.push(uid);
        results.noToken++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push({ uid, error: error.message });
    }
  }

  // Envoyer les notifications push
  if (tokens.length > 0) {
    try {
      const message = {
        notification: {
          title: title,
          body: body
        },
        data: {
          link: link || 'index.html',
          timestamp: Date.now().toString()
        },
        tokens: tokens
      };

      const response = await admin.messaging().sendMulticast(message);
      results.sent = response.successCount;
      results.failed += response.failureCount;

      // Logger les tokens invalides pour nettoyage
      if (response.failureCount > 0) {
        response.responses.forEach((resp,
