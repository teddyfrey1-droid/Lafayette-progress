// ═══════════════════════════════════════════════════════════════════════
// FIREBASE CLOUD FUNCTIONS - HEIKO LAFAYETTE
// ═══════════════════════════════════════════════════════════════════════

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURATION EMAIL (Mailgun)
// ═══════════════════════════════════════════════════════════════════════

const transporter = nodemailer.createTransport({
  host: 'smtp.mailgun.org',
  port: 587,
  secure: false,
  auth: {
    user: 'postmaster@sandbox123.mailgun.org', // ← REMPLACE avec ton user Mailgun
    pass: 'ton-mot-de-passe-mailgun'           // ← REMPLACE avec ton pass Mailgun
  }
});

// ═══════════════════════════════════════════════════════════════════════
// FONCTION 1 : ENVOYER UN EMAIL À PLUSIEURS UTILISATEURS
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
        from: '"Heiko Lafayette" <noreply@heiko.com>',
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
// FONCTION 2 : ENVOYER UNE NOTIFICATION PUSH À PLUSIEURS UTILISATEURS
// ═══════════════════════════════════════════════════════════════════════

exports.sendPushToUsers = functions.https.onCall(async (data, context) => {
  // Sécurité : Vérifier que l'utilisateur est authentifié et admin
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
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`Token invalide: ${tokens[idx]}`);
            // Optionnel : supprimer le token invalide de Firebase
            // await db.ref(`users/${userIds[idx]}/pushToken`).remove();
          }
        });
      }
    } catch (error) {
      console.error('Erreur envoi push:', error);
      results.errors.push({ error: error.message });
    }
  }

  return {
    sent: results.sent,
    failed: results.failed,
    noToken: results.noToken,
    usersWithoutToken: usersWithoutToken,
    errors: results.errors
  };
});

// ═══════════════════════════════════════════════════════════════════════
// FONCTION 3 : ENVOYER UN EMAIL À UN GROUPE
// ═══════════════════════════════════════════════════════════════════════

exports.sendEmailToGroup = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
  }

  const { groupId, subject, html, text } = data;

  if (!groupId || !subject || !html) {
    throw new functions.https.HttpsError('invalid-argument', 'Paramètres manquants');
  }

  const db = admin.database();

  // Récupérer le groupe
  const groupSnap = await db.ref(`mailGroups/${groupId}`).once('value');
  const group = groupSnap.val();

  if (!group || !group.members || group.members.length === 0) {
    throw new functions.https.HttpsError('not-found', 'Groupe vide ou introuvable');
  }

  // Envoyer à tous les membres du groupe
  const results = { sent: 0, failed: 0, errors: [] };

  for (const uid of group.members) {
    try {
      const userSnap = await db.ref(`users/${uid}`).once('value');
      const user = userSnap.val();

      if (!user || !user.email) {
        results.failed++;
        continue;
      }

      await transporter.sendMail({
        from: '"Heiko Lafayette" <noreply@heiko.com>',
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
// FONCTION 4 : TESTER LA CONFIGURATION EMAIL
// ═══════════════════════════════════════════════════════════════════════

exports.testEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
  }

  const { to } = data;

  if (!to) {
    throw new functions.https.HttpsError('invalid-argument', 'Email destinataire requis');
  }

  try {
    await transporter.sendMail({
      from: '"Heiko Lafayette" <noreply@heiko.com>',
      to: to,
      subject: '🧪 Test Email - Heiko Lafayette',
      html: '<h2>✅ Configuration email OK !</h2><p>Si tu reçois ce message, tout fonctionne.</p>'
    });

    return { success: true, message: 'Email envoyé avec succès' };
  } catch (error) {
    console.error('Erreur test email:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// FIN DU FICHIER
// ═══════════════════════════════════════════════════════════════════════
