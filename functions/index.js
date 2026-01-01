const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.database();

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURATION EMAIL
// ═══════════════════════════════════════════════════════════════════════

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().email?.user || 'ton-email@gmail.com',
    pass: functions.config().email?.password || 'ton-mot-de-passe'
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 1️⃣ ENVOI EMAIL GROUPÉ
// ═══════════════════════════════════════════════════════════════════════

exports.sendBulkEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
  }

  const userSnap = await db.ref(`users/${context.auth.uid}`).once('value');
  const userData = userSnap.val();
  if (!userData?.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Accès admin requis');
  }

  const { recipients, subject, html } = data;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Destinataires manquants');
  }

  try {
    const promises = recipients.map(email => {
      return transporter.sendMail({
        from: `"Heiko La Fayette" <${functions.config().email?.user}>`,
        to: email,
        subject: subject,
        html: html
      });
    });

    await Promise.all(promises);

    await db.ref('logs/emails').push({
      timestamp: Date.now(),
      adminId: context.auth.uid,
      recipients: recipients.length,
      subject: subject
    });

    return { success: true, sent: recipients.length };
  } catch (error) {
    console.error('Erreur email:', error);
    throw new functions.https.HttpsError('internal', 'Erreur envoi email');
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 2️⃣ ENVOI PUSH GROUPÉ
// ═══════════════════════════════════════════════════════════════════════

exports.sendPushToUsers = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
  }

  const userSnap = await db.ref(`users/${context.auth.uid}`).once('value');
  const userData = userSnap.val();
  if (!userData?.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Accès admin requis');
  }

  const { userIds, title, body } = data;

  if (!userIds || !Array.isArray(userIds)) {
    throw new functions.https.HttpsError('invalid-argument', 'UserIds manquants');
  }

  try {
    const tokens = [];

    for (const uid of userIds) {
      const snap = await db.ref(`users/${uid}`).once('value');
      const user = snap.val();
      if (user?.pushToken && user?.pushEnabled) {
        tokens.push(user.pushToken);
      }
    }

    if (tokens.length === 0) {
      return { success: true, sent: 0, message: 'Aucun token valide' };
    }

    const message = {
      notification: { title, body },
      tokens: tokens
    };

    const response = await admin.messaging().sendMulticast(message);

    await db.ref('logs/push').push({
      timestamp: Date.now(),
      adminId: context.auth.uid,
      recipients: tokens.length,
      title: title,
      success: response.successCount,
      failures: response.failureCount
    });

    return { 
      success: true, 
      sent: response.successCount,
      failed: response.failureCount 
    };

  } catch (error) {
    console.error('Erreur push:', error);
    throw new functions.https.HttpsError('internal', 'Erreur envoi push');
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 3️⃣ NOTIFICATION AUTO : Nouvel objectif
// ═══════════════════════════════════════════════════════════════════════

exports.onObjectivePublished = functions.database
  .ref('/objectives/{objId}')
  .onCreate(async (snapshot, context) => {
    const objective = snapshot.val();

    if (!objective.primary) return null;

    try {
      const usersSnap = await db.ref('users').once('value');
      const users = usersSnap.val();
      
      if (!users) return null;

      const emailRecipients = [];
      const pushTokens = [];

      Object.entries(users).forEach(([uid, user]) => {
        if (user.pushEnabled && user.pushToken) {
          pushTokens.push(user.pushToken);
        } else if (user.email) {
          emailRecipients.push(user.email);
        }
      });

      if (pushTokens.length > 0) {
        await admin.messaging().sendMulticast({
          notification: {
            title: '🎯 Nouvel objectif !',
            body: `${objective.name} - Objectif : ${objective.target}`
          },
          tokens: pushTokens
        });
      }

      if (emailRecipients.length > 0) {
        const promises = emailRecipients.map(email => {
          return transporter.sendMail({
            from: `"Heiko" <${functions.config().email?.user}>`,
            to: email,
            subject: '🎯 Nouvel objectif',
            html: `<h2>${objective.name}</h2><p>Objectif : ${objective.target}</p>`
          });
        });
        await Promise.all(promises);
      }

      return null;
    } catch (error) {
      console.error('Erreur notification:', error);
      return null;
    }
  });

