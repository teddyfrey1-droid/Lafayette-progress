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
async function assertAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Auth required");
  }

  const uid = context.auth.uid;
  const roleSnap = await admin.database().ref(`users/${uid}/role`).get();
  const role = roleSnap.exists() ? String(roleSnap.val()) : "";

  if (role !== "admin" && role !== "superadmin") {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  return { uid, role };
}

function normalizeAudience(aud) {
  const v = String(aud || "all").trim().toLowerCase();
  if (v === "admins") return "admins";
  if (v === "team") return "team";
  return "all";
}

function isAdminRole(role) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "superadmin";
}

async function collectTokensByAudience(audience) {
  // tokens: /fcmTokens/{uid}/{pushId} = { token, ... }
  const [tokensSnap, usersSnap] = await Promise.all([
    admin.database().ref("fcmTokens").get(),
    admin.database().ref("users").get(),
  ]);

  const allTokens = tokensSnap.exists() ? (tokensSnap.val() || {}) : {};
  const users = usersSnap.exists() ? (usersSnap.val() || {}) : {};

  const out = [];
  Object.keys(allTokens || {}).forEach((uid) => {
    const role = users && users[uid] ? users[uid].role : "";
    const admin = isAdminRole(role);

    if (audience === "admins" && !admin) return;
    if (audience === "team" && admin) return;

    const userTokens = allTokens[uid] || {};
    Object.keys(userTokens).forEach((k) => {
      const t = userTokens[k] && userTokens[k].token;
      if (t && typeof t === "string") out.push(t);
    });
  });

  return out;
}

async function sendMulticast({ title, body, link, audience }) {
  const tokens = await collectTokensByAudience(audience);
  if (!tokens.length) {
    return { ok: false, sent: 0, failed: 0, total: 0, reason: "No tokens" };
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
      data: { link: String(link || "/index.html#dashboard") },
      webpush: {
        fcmOptions: { link: String(link || "/index.html#dashboard") },
      },
    };

    const res = await admin.messaging().sendEachForMulticast(message);
    sent += res.successCount;
    failed += res.failureCount;
  }

  return { ok: true, sent, failed, total: tokens.length, audience };
}

/**
 * Callable utilisé par le front: sendPush
 * - title (string)
 * - body (string)
 * - link (string)
 * - audience (all|team|admins)
 */
exports.sendPush = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);
  const title = (data && data.title) ? String(data.title) : "Heiko";
  const body = (data && data.body) ? String(data.body) : "";
  const link = (data && data.link) ? String(data.link) : "/index.html#dashboard";
  const audience = normalizeAudience(data && data.audience);
  return await sendMulticast({ title, body, link, audience });
});

// Compat: ancien nom (ou usage direct)
exports.sendPushToAll = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);
  const title = (data && data.title) ? String(data.title) : "Heiko";
  const body = (data && data.body) ? String(data.body) : "";
  const link = (data && data.link) ? String(data.link) : "/index.html#dashboard";
  return await sendMulticast({ title, body, link, audience: "all" });
});
