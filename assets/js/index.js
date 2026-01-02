cat > functions/index.js <<'ENDJS'
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.sendBulkEmail = functions.https.onCall(async (data, context) => {
  // Vérifie que l'utilisateur est connecté
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentification requise');
  }

  // Vérifie que l'utilisateur est admin
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

  console.log(`Envoi vers ${recipients.length} destinataires via ${channel}`);

  let sentCount = 0;

  // Récupère tous les users pour avoir les tokens FCM
  const usersSnapshot = await admin.database().ref('users').once('value');
  const allUsers = usersSnapshot.val() || {};

  // Crée un map email -> user
  const emailToUser = {};
  for (const uid in allUsers) {
    const u = allUsers[uid];
    if (u.email) {
      emailToUser[u.email.toLowerCase().trim()] = { uid, ...u };
    }
  }

  if (channel === 'email' || channel === 'both') {
    // Envoi par email (simulation - remplace par ton service email)
    console.log(`📧 Envoi email à ${recipients.length} destinataires`);
    console.log('Sujet:', subject);
    console.log('HTML:', html.substring(0, 100) + '...');
    
    // TODO: Intègre ici ton service d'envoi d'emails (SendGrid, Mailgun, etc.)
    // Exemple avec SendGrid :
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.sendMultiple({ to: recipients, subject, html });
    
    sentCount += recipients.length;
  }

  if (channel === 'push' || channel === 'both') {
    // Envoi de notifications push
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

    console.log(`🔔 ${tokens.length} tokens push trouvés`);
    console.log(`📧 ${emailsWithoutPush.length} utilisateurs sans push`);

    if (tokens.length > 0) {
      try {
        const message = {
          notification: {
            title: subject,
            body: html.replace(/<[^>]*>/g, '').substring(0, 100) // Retire le HTML
          },
          tokens: tokens
        };

        const response = await admin.messaging().sendMulticast(message);
        console.log(`✅ Push envoyées: ${response.successCount}/${tokens.length}`);
        sentCount += response.successCount;
      } catch (error) {
        console.error('Erreur envoi push:', error);
      }
    }

    // Fallback email pour ceux sans push
    if (fallbackToEmail && emailsWithoutPush.length > 0) {
      console.log(`📧 Fallback email vers ${emailsWithoutPush.length} utilisateurs`);
      // TODO: Envoie par email
      sentCount += emailsWithoutPush.length;
    }
  }

  // Log l'action
  await admin.database().ref('logs/diffusion').push({
    timestamp: Date.now(),
    userId: context.auth.uid,
    userEmail: context.auth.token.email || '',
    channel,
    recipientCount: recipients.length,
    subject,
    meta
  });

  return {
    success: true,
    sent: sentCount,
    total: recipients.length
  };
});
ENDJS

echo "✅ functions/index.js créé"
