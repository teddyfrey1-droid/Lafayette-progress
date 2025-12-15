const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Envoie une notification (FCM) à tous les tokens stockés dans RTDB: /fcmTokens/{uid}/pushId
 * Sécurité: réservé aux utilisateurs role = 'admin' ou 'superadmin' (dans /users/{uid}/role)
 *
 * Appel (Callable):
 *  - title (string)
 *  - body (string)
 *  - link (string, optionnel) ex: "/index.html#dashboard"
 */
exports.sendPushToAll = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Auth required");
  }

  const uid = context.auth.uid;
  const roleSnap = await admin.database().ref(`users/${uid}/role`).get();
  const role = roleSnap.exists() ? String(roleSnap.val()) : "";

  if (role !== "admin" && role !== "superadmin") {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  const title = (data && data.title) ? String(data.title) : "Heiko";
  const body = (data && data.body) ? String(data.body) : "";
  const link = (data && data.link) ? String(data.link) : "/index.html#dashboard";

  // Récupère tous les tokens
  const root = await admin.database().ref("fcmTokens").get();
  const all = root.exists() ? root.val() : {};
  const tokens = [];

  Object.keys(all || {}).forEach(u => {
    const userTokens = all[u] || {};
    Object.keys(userTokens).forEach(k => {
      const t = userTokens[k] && userTokens[k].token;
      if (t && typeof t === "string") tokens.push(t);
    });
  });

  if (!tokens.length) {
    return { ok: false, sent: 0, reason: "No tokens" };
  }

  // Envoi par batch (FCM limite 500 tokens / multicast)
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

  let sent = 0;
  let failed = 0;

  for (const chunk of chunks) {
    const message = {
      tokens: chunk,
      notification: { title, body },
      webpush: {
        fcmOptions: { link }
      }
    };

    const res = await admin.messaging().sendEachForMulticast(message);
    sent += res.successCount;
    failed += res.failureCount;

    // Optionnel: nettoyage tokens invalides (désactivé pour éviter toute suppression involontaire)
    // res.responses.forEach((r, idx) => {
    //   if (!r.success) console.log("FCM error", r.error && r.error.code, chunk[idx]);
    // });
  }

  return { ok: true, sent, failed, total: tokens.length };
});
