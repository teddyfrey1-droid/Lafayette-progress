// ═══════════════════════════════════════════════════════════════════════
// FIREBASE CLOUD FUNCTIONS - HEIKO LAFAYETTE (v7)
// ═══════════════════════════════════════════════════════════════════════

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURATION EMAIL (GMAIL)
// ═══════════════════════════════════════════════════════════════════════

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'lafayetteheiko@gmail.com',
    pass: 'ton-mot-de-passe-application-gmail'  // ← REMPLACE PAR TON MOT DE PASSE APPLICATION
  }
});

// Pour créer un mot de passe d'application Gmail :
// 1. Va sur https://myaccount.google.com/security
// 2. Active la validation en 2 étapes
// 3. Va dans "Mots de passe des applications"
// 4. Crée un mot de passe pour "Mail"
// 5. Copie le mot de passe généré ici

// ═══════════════════════════════════════════════════════════════════════
// FONCTION : ENVOI EMAIL À PLUSIEURS UTILISATEURS
// ═══════════════════════════════════════════════════════════════════════

exports.sendEmailToUsers = onCall(
  {
    region: 'us-central1',
    cors: true,
    maxInstances: 10
  },
  async (request) => {
    // Debug complet
    console.log('🔍 Request auth:', request.auth);
    console.log('🔍 Request rawRequest headers:', request.rawRequest?.headers?.authorization);
    
    if (!request.auth) {
      console.error('❌ Pas d\'authentification');
      throw new HttpsError('unauthenticated', 'Non authentifié');
    }

    console.log('✅ User authentifié:', request.auth.uid);

    const { userIds, subject, html, text } = request.data;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw new HttpsError('invalid-argument', 'userIds requis');
    }

    if (!subject || !html) {
      throw new HttpsError('invalid-argument', 'subject et html requis');
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
        console.log(`✅ Email envoyé à: ${user.email}`);
      } catch (error) {
        results.failed++;
        results.errors.push({ uid, error: error.message });
        console.error(`❌ Erreur pour ${uid}:`, error.message);
      }
    }

    return results;
  }
);

// ═══════════════════════════════════════════════════════════════════════
// FONCTION : ENVOI PUSH À PLUSIEURS UTILISATEURS
// ═══════════════════════════════════════════════════════════════════════

exports.sendPushToUsers = onCall(
  {
    region: 'us-central1',
    cors: true
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Non authentifié');
    }

    const { userIds, title, body, link } = request.data;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw new HttpsError('invalid-argument', 'userIds requis');
    }

    if (!title || !body) {
      throw new HttpsError('invalid-argument', 'title et body requis');
    }

    const db = admin.database();
    const results = { sent: 0, failed: 0, noToken: 0, errors: [] };
    const tokens = [];

    for (const uid of userIds) {
      try {
        const userSnap = await db.ref(`users/${uid}`).once('value');
        const user = userSnap.val();

        if (!user) {
          results.failed++;
          continue;
        }

        if (user.pushToken && user.pushEnabled === true) {
          tokens.push(user.pushToken);
        } else {
          results.noToken++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ uid, error: error.message });
      }
    }

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

        const response = await admin.messaging().sendEachForMulticast(message);
        results.sent = response.successCount;
        results.failed += response.failureCount;
      } catch (error) {
        console.error('Erreur envoi push:', error);
        results.errors.push({ error: error.message });
      }
    }

    return results;
  }
);

// ═══════════════════════════════════════════════════════════════════════
// FONCTION : ENVOI EMAIL À UN GROUPE
// ═══════════════════════════════════════════════════════════════════════

exports.sendEmailToGroup = onCall(
  {
    region: 'us-central1',
    cors: true
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Non authentifié');
    }

    const { groupId, subject, html, text } = request.data;

    if (!groupId || !subject || !html) {
      throw new HttpsError('invalid-argument', 'Paramètres manquants');
    }

    const db = admin.database();
    const groupSnap = await db.ref(`mailGroups/${groupId}`).once('value');
    const group = groupSnap.val();

    if (!group || !group.userIds || group.userIds.length === 0) {
      throw new HttpsError('not-found', 'Groupe vide ou introuvable');
    }

    const results = { sent: 0, failed: 0, errors: [] };

    for (const uid of group.userIds) {
      try {
        const userSnap = await db.ref(`users/${uid}`).once('value');
        const user = userSnap.val();

        if (!user || !user.email) {
          results.failed++;
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
  }
);

// ═══════════════════════════════════════════════════════════════════════
// FONCTION : TEST EMAIL
// ═══════════════════════════════════════════════════════════════════════

exports.testEmail = onCall(
  {
    region: 'us-central1',
    cors: true
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Non authentifié');
    }

    const { to } = request.data;

    if (!to) {
      throw new HttpsError('invalid-argument', 'Email destinataire requis');
    }

    try {
      await transporter.sendMail({
        from: '"Heiko Lafayette" <lafayetteheiko@gmail.com>',
        to: to,
        subject: '🧪 Test Email - Heiko Lafayette',
        html: '<h2>✅ Configuration email OK !</h2><p>Si tu reçois ce message, tout fonctionne.</p>'
      });

      return { success: true, message: 'Email envoyé avec succès' };
    } catch (error) {
      console.error('Erreur test email:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════
// FIN DU FICHIER
// ═══════════════════════════════════════════════════════════════════════
