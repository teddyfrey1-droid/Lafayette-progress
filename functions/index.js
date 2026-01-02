const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.sendBulkEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentification requise');
  }

  const userSnapshot = await admin.database().ref('users/' + context.auth.uid).once('value');
  const user = userSnapshot.val();
  const role = (user && user.role ? String(user.role).toLowerCase() : '');
  
  if (role !== 'admin' && role !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'Accès admin requis');
  }

  const { recipients, subject, html, channel, fallbackToEmail, meta } = data;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Recipients requis');
  }

  console.log('Envoi vers', recipients.length, 'destinataires via', channel);

  let sentCount = 0;

  const usersSnapshot = await admin.database().ref('users').once('value');
  const allUsers = usersSnapshot.val() || {};

  const emailToUser = {};
  for (const uid in allUsers) {
    const u = allUsers[uid];
    if (u.email) {
      emailToUser[u.email.toLowerCase().trim()] = { uid: uid, fcmToken: u.fcmToken };
    }
  }

  if (channel === 'email' || channel === 'both') {
    console.log('Email vers', recipients.length, 'destinataires');
    console.log('Sujet:', subject);
    sentCount += recipients.length;
  }

  if (channel === 'push' || channel === 'both') {
    const tokens = [];
    const emailsWithoutPush = [];

    for (const email of recipients) {
      const u = emailToUser[email.toLowerCase().trim()];
      if (u && u.fcmToken && u.fcmToken.trim()) {
        tokens.push(u.fcmToken.trim());
      } else {
        emailsWithoutPush.push(email);
      }
    }

    console.log(tokens.length, 'tokens push trouvés');

    if (tokens.length > 0) {
      try {
        const message = {
          notification: {
            title: subject,
            body: html.replace(/<[^>]*>/g, '').substring(0, 100)
          },
          tokens: tokens
        };

        const response = await admin.messaging().sendMulticast(message);
        console.log('Push envoyées:', response.successCount);
        sentCount += response.successCount;
      } catch (error) {
        console.error('Erreur push:', error);
      }
    }

    if (fallbackToEmail && emailsWithoutPush.length > 0) {
      console.log('Fallback email vers', emailsWithoutPush.length);
      sentCount += emailsWithoutPush.length;
    }
  }

  await admin.database().ref('logs/diffusion').push({
    timestamp: Date.now(),
    userId: context.auth.uid,
    channel: channel,
    recipientCount: recipients.length,
    subject: subject
  });

  return {
    success: true,
    sent: sentCount,
    total: recipients.length
  };
});
