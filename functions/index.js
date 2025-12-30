// ═══════════════════════════════════════════════════════════════════════
// ✨ CLOUD FUNCTIONS - HEIKO LAFAYETTE
// ═══════════════════════════════════════════════════════════════════════
// Fonctions:
// - sendEmailToUser: Envoyer un email à un utilisateur
// - sendEmailToUsers: Envoyer un email à plusieurs utilisateurs
// - getSmtpConfigStatus: Obtenir le statut de la config SMTP
// - setSmtpConfig: Définir la configuration SMTP
// - testSmtp: Tester la configuration SMTP
// - sendPushToUsers: Envoyer des notifications push (NOUVEAU)
// ═══════════════════════════════════════════════════════════════════════

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialiser Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.database();

// ═══════════════════════════════════════════════════════════════════════
// FONCTIONS EMAIL
// ═══════════════════════════════════════════════════════════════════════

/**
 * Envoyer un email à un utilisateur spécifique
 */
exports.sendEmailToUser = functions.https.onCall(async (data, context) => {
  // Vérifier l'authentification
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId, subject, html, text } = data;

  if (!userId || !subject) {
    throw new functions.https.HttpsError('invalid-argument', 'userId and subject are required');
  }

  try {
    // Récupérer la config SMTP
    const smtpConfigSnap = await db.ref('configPrivate/smtp').once('value');
    const smtpConfig = smtpConfigSnap.val();

    if (!smtpConfig || !smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      throw new functions.https.HttpsError('failed-precondition', 'SMTP configuration is incomplete');
    }

    // Récupérer l'email de l'utilisateur
    const userSnap = await db.ref(`users/${userId}/email`).once('value');
    const userEmail = userSnap.val();

    if (!userEmail) {
      throw new functions.https.HttpsError('not-found', 'User email not found');
    }

    // Créer le transporter
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: parseInt(smtpConfig.port) || 587,
      secure: parseInt(smtpConfig.port) === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      }
    });

    // Envoyer l'email
    const mailOptions = {
      from: smtpConfig.from || smtpConfig.user,
      to: userEmail,
      subject: subject,
      html: html || text || '',
      text: text || ''
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`Email sent to ${userEmail}:`, info.messageId);

    return {
      success: true,
      messageId: info.messageId,
      recipient: userEmail
    };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Envoyer un email à plusieurs utilisateurs
 */
exports.sendEmailToUsers = functions.https.onCall(async (data, context) => {
  // Vérifier l'authentification
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userIds, subject, html, text } = data;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'userIds must be a non-empty array');
  }

  if (!subject) {
    throw new functions.https.HttpsError('invalid-argument', 'subject is required');
  }

  try {
    // Récupérer la config SMTP
    const smtpConfigSnap = await db.ref('configPrivate/smtp').once('value');
    const smtpConfig = smtpConfigSnap.val();

    if (!smtpConfig || !smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      throw new functions.https.HttpsError('failed-precondition', 'SMTP configuration is incomplete');
    }

    // Créer le transporter
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: parseInt(smtpConfig.port) || 587,
      secure: parseInt(smtpConfig.port) === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      }
    });

    // Récupérer les emails des utilisateurs
    const usersSnapshot = await db.ref('users').once('value');
    const users = usersSnapshot.val() || {};

    const emails = [];
    userIds.forEach(uid => {
      const user = users[uid];
      if (user && user.email) {
        emails.push(user.email);
      }
    });

    if (emails.length === 0) {
      console.log('No valid emails found');
      return { success: true, sent: 0, message: 'No users with valid emails' };
    }

    // Envoyer les emails (BCC pour masquer les destinataires)
    const mailOptions = {
      from: smtpConfig.from || smtpConfig.user,
      bcc: emails,
      subject: subject,
      html: html || text || '',
      text: text || ''
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`Email sent to ${emails.length} recipients:`, info.messageId);

    return {
      success: true,
      sent: emails.length,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Error sending emails:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Obtenir le statut de la configuration SMTP
 */
exports.getSmtpConfigStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const snap = await db.ref('configPrivate/smtp').once('value');
    const config = snap.val();

    return {
      configured: !!(config && config.host && config.user && config.pass),
      host: config?.host || '',
      port: config?.port || '',
      user: config?.user || '',
      from: config?.from || ''
    };
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Définir la configuration SMTP
 */
exports.setSmtpConfig = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { host, port, user, pass, from } = data;

  if (!host || !port || !user || !pass) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required SMTP config fields');
  }

  try {
    await db.ref('configPrivate/smtp').set({
      host,
      port,
      user,
      pass,
      from: from || user,
      updatedAt: Date.now(),
      updatedBy: context.auth.uid
    });

    return { success: true };
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Tester la configuration SMTP
 */
exports.testSmtp = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const smtpConfigSnap = await db.ref('configPrivate/smtp').once('value');
    const smtpConfig = smtpConfigSnap.val();

    if (!smtpConfig || !smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      throw new functions.https.HttpsError('failed-precondition', 'SMTP configuration is incomplete');
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: parseInt(smtpConfig.port) || 587,
      secure: parseInt(smtpConfig.port) === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      }
    });

    // Récupérer l'email de l'utilisateur
    const userSnap = await db.ref(`users/${context.auth.uid}/email`).once('value');
    const userEmail = userSnap.val();

    if (!userEmail) {
      throw new functions.https.HttpsError('not-found', 'User email not found');
    }

    const mailOptions = {
      from: smtpConfig.from || smtpConfig.user,
      to: userEmail,
      subject: '🧪 Test SMTP - Heiko Lafayette',
      html: `
        <h2>✅ Configuration SMTP fonctionnelle</h2>
        <p>Ce message confirme que votre configuration SMTP est correctement configurée.</p>
        <p><strong>Serveur:</strong> ${smtpConfig.host}:${smtpConfig.port}</p>
        <p><strong>Utilisateur:</strong> ${smtpConfig.user}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Heiko Lafayette - Système de notifications</p>
      `
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
      recipient: userEmail
    };
  } catch (error) {
    console.error('SMTP test error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// NOTIFICATIONS PUSH (NOUVEAU)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Envoyer des notifications push à plusieurs utilisateurs
 */
exports.sendPushToUsers = functions.https.onCall(async (data, context) => {
  // Vérifier l'authentification
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userIds, title, body, link } = data;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'userIds must be a non-empty array');
  }

  if (!title) {
    throw new functions.https.HttpsError('invalid-argument', 'title is required');
  }

  try {
    // Récupérer les tokens des utilisateurs
    const usersSnapshot = await db.ref('users').once('value');
    const users = usersSnapshot.val() || {};

    const tokens = [];
    userIds.forEach(uid => {
      const user = users[uid];
      if (user && user.pushEnabled && user.pushToken) {
        tokens.push(user.pushToken);
      }
    });

    if (tokens.length === 0) {
      console.log('No valid push tokens found');
      return { success: true, sent: 0, message: 'No users with push enabled' };
    }

    // Préparer le message
    const message = {
      notification: {
        title: title,
        body: body || ''
      },
      data: {
        link: link || '/',
        timestamp: Date.now().toString()
      },
      tokens: tokens
    };

    // Envoyer via FCM
    const response = await admin.messaging().sendMulticast(message);

    console.log(`✅ Push notification sent: ${response.successCount} success, ${response.failureCount} failures`);

    // Nettoyer les tokens invalides
    if (response.failureCount > 0) {
      const tokensToRemove = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          tokensToRemove.push(tokens[idx]);
        }
      });

      // Supprimer les tokens invalides de la base de données
      const updates = {};
      Object.keys(users).forEach(uid => {
        const user = users[uid];
        if (user && user.pushToken && tokensToRemove.includes(user.pushToken)) {
          updates[`users/${uid}/pushEnabled`] = false;
          updates[`users/${uid}/pushToken`] = null;
        }
      });

      if (Object.keys(updates).length > 0) {
        await db.ref().update(updates);
        console.log(`🧹 Cleaned ${Object.keys(updates).length / 2} invalid tokens`);
      }
    }

    return {
      success: true,
      sent: response.successCount,
      failed: response.failureCount
    };
  } catch (error) {
    console.error('❌ Error sending push notifications:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// FIN DU FICHIER
// ═══════════════════════════════════════════════════════════════════════
