const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Envoie une notification (FCM) aux tokens stockés dans RTDB: /fcmTokens/{uid}/{pushId}
 * Sécurité: réservé aux utilisateurs role = 'admin' ou 'superadmin' (dans /users/{uid}/role)
 *
 * Callable: sendPush
 * data:
 *  - title (string)
 *  - body (string)
 *  - link (string, optionnel) ex: "/index.html#dashboard"
 *  - audience (string): "all" | "team" | "admins" | "user"
 *  - targetUid (string, optionnel) quand audience="user"
 */
exports.sendPush = functions.https.onCall(async (data, context) => {
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
  const audience = (data && data.audience) ? String(data.audience) : "all";
  const targetUid = (data && data.targetUid) ? String(data.targetUid) : "";

  // Récupère tokens + (si besoin) rôles utilisateurs
  const [tokensSnap, usersSnap] = await Promise.all([
    admin.database().ref("fcmTokens").get(),
    admin.database().ref("users").get(),
  ]);

  const allTokens = tokensSnap.exists() ? tokensSnap.val() : {};
  const allUsers = usersSnap.exists() ? usersSnap.val() : {};

  // Filtre uids cibles
  let allowedUids = new Set(Object.keys(allTokens || {}));

  if (audience === "user") {
    if (!targetUid) {
      throw new functions.https.HttpsError("invalid-argument", "targetUid required");
    }
    allowedUids = new Set([targetUid]);
  } else if (audience === "admins") {
    allowedUids = new Set(
      Object.keys(allUsers || {}).filter(u => {
        const r = allUsers[u] && allUsers[u].role ? String(allUsers[u].role) : "";
        return (r === "admin" || r === "superadmin");
      })
    );
  } else if (audience === "team") {
    allowedUids = new Set(
      Object.keys(allUsers || {}).filter(u => {
        const r = allUsers[u] && allUsers[u].role ? String(allUsers[u].role) : "";
        return (r !== "admin" && r !== "superadmin");
      })
    );
  } else {
    // "all": keep all tokens
  }

  // Collect tokens for allowed Uids
  const tokens = [];
  Object.keys(allTokens || {}).forEach(u => {
    if (!allowedUids.has(u)) return;
    const userTokens = allTokens[u] || {};
    Object.keys(userTokens).forEach(k => {
      const t = userTokens[k] && userTokens[k].token;
      if (t && typeof t === "string") tokens.push(t);
    });
  });

  if (!tokens.length) {
    return { ok: false, sent: 0, failed: 0, reason: "No tokens for audience" };
  }

  let sent = 0;
  let failed = 0;
  const chunkSize = 500;

  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);

    const message = {
      tokens: chunk,
      notification: { title, body },
      data: { link },
      webpush: { fcmOptions: { link } },
    };

    const res = await admin.messaging().sendEachForMulticast(message);
    sent += res.successCount;
    failed += res.failureCount;
  }

  return { ok: true, sent, failed, audience };
});

// Backward compatibility: old callable name
exports.sendPushToAll = exports.sendPush;
