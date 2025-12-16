const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// ⚠️ Super admin (fallback si role pas encore bien renseigné)
const SUPER_ADMIN_EMAIL = "teddy.frey1@gmail.com";

function isPrivileged(role, email) {
  const r = String(role || "").toLowerCase();
  const e = String(email || "").toLowerCase();
  return r === "admin" || r === "superadmin" || (e && e === String(SUPER_ADMIN_EMAIL).toLowerCase());
}

/**
 * Callable: sendPush
 *
 * data:
 *  - title (string)
 *  - body (string)
 *  - link (string) ex: "/index.html#dashboard"
 *  - audience (string): "all" | "admins" | "users" | "team"(alias) | "one"
 *  - targetUid (string) requis si audience="one"
 *
 * Stockage tokens:
 *  - RTDB: /fcmTokens/{uid}/{tokenId} = { token, ua, standalone, updatedAt }
 *
 * Sécurité:
 *  - réservé aux admin/superadmin (users/{uid}/role) ou SUPER_ADMIN_EMAIL
 */
exports.sendPush = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Auth required");
  }

  const callerUid = context.auth.uid;
  const callerEmail = (context.auth.token && context.auth.token.email) ? String(context.auth.token.email) : "";

  // Vérif role
  const roleSnap = await admin.database().ref(`users/${callerUid}/role`).get();
  const role = roleSnap.exists() ? String(roleSnap.val()) : "";
  if (!isPrivileged(role, callerEmail)) {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  const title = (data && data.title) ? String(data.title) : "Heiko";
  const body = (data && data.body) ? String(data.body) : "";
  const link = (data && data.link) ? String(data.link) : "/index.html#dashboard";

  let audience = (data && data.audience) ? String(data.audience) : "all";
  if (audience === "team") audience = "users"; // alias historique

  const targetUid = (data && data.targetUid) ? String(data.targetUid) : "";

  // Charge tokens
  const tokensSnap = await admin.database().ref("fcmTokens").get();
  const tokensByUid = tokensSnap.exists() ? tokensSnap.val() : {};

  // Détermine les UIDs destinataires
  let recipientUids = [];

  if (audience === "all") {
    recipientUids = Object.keys(tokensByUid || {});
  } else if (audience === "one") {
    if (!targetUid) {
      throw new functions.https.HttpsError("invalid-argument", "targetUid required when audience=one");
    }
    recipientUids = [targetUid];
  } else if (audience === "admins" || audience === "users") {
    const usersSnap = await admin.database().ref("users").get();
    const users = usersSnap.exists() ? usersSnap.val() : {};
    recipientUids = Object.keys(users || {}).filter((uid) => {
      const u = users[uid] || {};
      const r = String(u.role || "").toLowerCase();
      const mail = String(u.email || "").toLowerCase();
      const isAdmin = r === "admin" || r === "superadmin" || (mail && mail === String(SUPER_ADMIN_EMAIL).toLowerCase());
      return audience === "admins" ? isAdmin : !isAdmin;
    });
  } else {
    // fallback
    recipientUids = Object.keys(tokensByUid || {});
    audience = "all";
  }

  // Construit liste tokens + mapping pour cleanup
  const tokenEntries = [];
  (recipientUids || []).forEach((uid) => {
    const bucket = (tokensByUid && tokensByUid[uid]) ? tokensByUid[uid] : null;
    if (!bucket) return;
    Object.keys(bucket).forEach((k) => {
      const t = bucket[k] && bucket[k].token;
      if (t && typeof t === "string") tokenEntries.push({ token: t, uid, key: k });
    });
  });

  if (!tokenEntries.length) {
    return { ok: false, sent: 0, failed: 0, total: 0, removed: 0, reason: "No tokens", audience, targetUid: targetUid || null };
  }

  // Dedupe
  const seen = new Set();
  const deduped = [];
  for (const e of tokenEntries) {
    if (!seen.has(e.token)) { seen.add(e.token); deduped.push(e); }
  }

  // Envoi par batch (FCM limite 500 tokens / multicast)
  const chunks = [];
  for (let i = 0; i < deduped.length; i += 500) chunks.push(deduped.slice(i, i + 500));

  let sent = 0;
  let failed = 0;
  const toRemove = []; // {uid,key}

  for (const chunk of chunks) {
    const message = {
      tokens: chunk.map(x => x.token),
      notification: { title, body },
      webpush: {
        fcmOptions: { link }
      },
      data: {
        link
      }
    };

    const res = await admin.messaging().sendEachForMulticast(message);
    sent += res.successCount;
    failed += res.failureCount;

    // Nettoyage tokens invalides (safe)
    res.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error && r.error.code ? String(r.error.code) : "";
        // tokens obsolètes / désinscrits
        if (code.includes("registration-token-not-registered") || code.includes("invalid-argument")) {
          toRemove.push({ uid: chunk[idx].uid, key: chunk[idx].key });
        }
      }
    });
  }

  // Remove invalid tokens
  let removed = 0;
  if (toRemove.length) {
    const updates = {};
    toRemove.forEach(({ uid, key }) => {
      updates[`fcmTokens/${uid}/${key}`] = null;
    });
    try {
      await admin.database().ref().update(updates);
      removed = toRemove.length;
    } catch (e) {
      // ignore cleanup failure
    }
  }

  return {
    ok: true,
    sent,
    failed,
    total: deduped.length,
    removed,
    audience,
    targetUid: targetUid || null
  };
});

// Backward compatibility (ancienne fonction)
exports.sendPushToAll = exports.sendPush;
