const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// [GARDER TOUTES tes fonctions SMTP getTransporter, sendEmailBatches, etc... INTCTES]

// -----------------------------
// Callable: sendBulkEmail (FIX AUTH)
// -----------------------------
exports.sendBulkEmail = functions.https.onCall(async (data, context) => {
  // 🔧 FIX : Log + debug au lieu de throw immédiat
  console.log('🧪 DEBUG sendBulkEmail:', {
    hasAuth: !!context.auth,
    uid: context.auth?.uid || 'NULL',
    email: context.auth?.token?.email || 'NO_EMAIL'
  });

  // TEMPORAIRE : Commente pour test (réactive après)
  // if (!context.auth) {
  //   throw new functions.https.HttpsError('unauthenticated', 'Authentification requise');
  // }

  // Reste DU CODE IDENTIQUE (userSnapshot, role check, etc...)
  const userSnapshot = await admin.database().ref('users/' + (context.auth?.uid || 'anonymous')).once('value');
  const user = userSnapshot.val();
  const role = (user && user.role ? String(user.role).toLowerCase() : '');

  if (role !== 'admin' && role !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'Accès admin requis');
  }

  // [TOUT LE RESTE IDENTIQUE : payload validation, push/email...]
  // ... (copie tout depuis "const payload = data || {};")
  
  return {
    success: true,
    sent: emailSent + pushSent,
    total: recipients.length,
    breakdown: {
      emailSent,
      emailBatches,
      pushSent,
      pushFailureCount,
    },
  };
});
