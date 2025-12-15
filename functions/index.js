/**
 * Cloud Functions for Firebase (1st gen) - Push notifications with targeting
 * - Callable: sendPush
 * - Stores/reads tokens from RTDB: /fcmTokens/{uid}/{tokenId}
 * - User meta (role, pushEnabled, etc.): /users/{uid}/...
 *
 * Requirements:
 *   - firebase-admin, firebase-functions
 *   - Node 18 (recommended)
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// ---- helpers ----
async function assertAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = context.auth.uid;
  const roleSnap = await admin.database().ref(`users/${uid}/role`).once("value");
  const role = String(roleSnap.val() || "staff").toLowerCase();
  if (role !== "admin" && role !== "superadmin") {
    throw new functions.https.HttpsError("permission-denied", "Admin or superadmin required.");
  }
  return { uid, role };
}

function audienceAllowsUser(user, audience) {
  const role = String(user?.role || "staff").toLowerCase();
  if (audience === "admins") return role === "admin" || role === "superadmin";
  if (audience === "team") return !(role === "admin" || role === "superadmin");
  return true; // all
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function collectTokensForUids(uids) {
  const tokens = [];
  for (const uid of uids) {
    const snap = await admin.database().ref(`fcmTokens/${uid}`).once("value");
    snap.forEach((child) => {
      const v = child.val();
      if (v && typeof v.token === "string" && v.token.trim()) tokens.push(v.token.trim());
    });
  }
  // unique
  return Array.from(new Set(tokens));
}

async function deleteBadTokensFromDb(uids, resultsByToken) {
  // Optionally remove invalid tokens from RTDB
  // resultsByToken: Map token -> {success:boolean, errorCode?:string}
  // We only remove tokens for "not-registered" / "invalid-argument"
  const badCodes = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token"]);
  for (const uid of uids) {
    const ref = admin.database().ref(`fcmTokens/${uid}`);
    const snap = await ref.once("value");
    const updates = {};
    snap.forEach((child) => {
      const v = child.val();
      const t = v?.token;
      if (typeof t === "string") {
        const r = resultsByToken.get(t);
        if (r && !r.success && badCodes.has(r.errorCode)) {
          updates[child.key] = null; // delete this token entry
        }
      }
    });
    if (Object.keys(updates).length) {
      await ref.update(updates);
    }
  }
}

/**
 * Callable function: sendPush
 *
 * data:
 *  - title: string
 *  - body: string
 *  - link?: string (opens on click)
 *  - audience?: "all" | "admins" | "team"
 *  - targetMode?: "all" | "pushEnabled" | "custom"
 *  - targetUids?: string[] (only if targetMode === "custom")
 */
exports.sendPush = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);

  const title = String(data?.title || "").trim();
  const body = String(data?.body || "").trim();
  const link = String(data?.link || "/").trim() || "/";
  const audience = String(data?.audience || "all").toLowerCase();
  const targetMode = String(data?.targetMode || "all").toLowerCase();
  const targetUids = Array.isArray(data?.targetUids) ? data.targetUids.map(String) : [];

  if (!title || !body) {
    throw new functions.https.HttpsError("invalid-argument", "title and body are required.");
  }

  // Load users
  const usersSnap = await admin.database().ref("users").once("value");
  const users = usersSnap.val() || {};

  // Base audience selection
  let uids = Object.keys(users).filter((uid) => audienceAllowsUser(users[uid], audience));

  // Target selection
  if (targetMode === "pushenabled") {
    uids = uids.filter((uid) => !!users[uid]?.pushEnabled);
  } else if (targetMode === "custom") {
    const wanted = new Set(targetUids);
    uids = uids.filter((uid) => wanted.has(uid));
  }

  const tokens = await collectTokensForUids(uids);

  if (tokens.length === 0) {
    return { ok: true, sent: 0, failed: 0, totalUsers: uids.length, totalTokens: 0 };
  }

  // Admin SDK multicast: max 500 tokens per call
  const batches = chunk(tokens, 500);

  let sent = 0;
  let failed = 0;

  // Track per-token results so we can delete invalid tokens
  const resultsByToken = new Map(); // token -> {success, errorCode}
  for (const batch of batches) {
    const res = await admin.messaging().sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      webpush: { fcmOptions: { link } }
    });

    sent += res.successCount;
    failed += res.failureCount;

    res.responses.forEach((r, idx) => {
      const token = batch[idx];
      if (r.success) {
        resultsByToken.set(token, { success: true });
      } else {
        resultsByToken.set(token, { success: false, errorCode: r.error?.code || "unknown" });
      }
    });
  }

  // Cleanup invalid tokens (optional but recommended)
  await deleteBadTokensFromDb(uids, resultsByToken);

  return { ok: true, sent, failed, totalUsers: uids.length, totalTokens: tokens.length };
});

// Backward compatibility: if you previously called sendPushToAll
exports.sendPushToAll = functions.https.onCall(async (data, context) => {
  return exports.sendPush({ ...(data || {}), audience: "all", targetMode: "all" }, context);
});
