const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * RTDB:
 *  - /users/{uid}/role
 *  - /fcmTokens/{uid}/{tokenKey} = { token, ua, standalone, updatedAt }
 */

async function getRole(uid) {
  const snap = await admin.database().ref(`users/${uid}/role`).get();
  const role = snap.exists() ? String(snap.val() || "").toLowerCase() : "staff";
  return role || "staff";
}

async function assertIsAdmin(uid) {
  const role = await getRole(uid);
  if (role !== "admin" && role !== "superadmin") {
    throw new functions.https.HttpsError("permission-denied", "Admin only.");
  }
  return role;
}

function normalizeStr(x, maxLen) {
  const s = (x == null) ? "" : String(x);
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function isAdminRole(role) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "superadmin";
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function readAllTokens() {
  const snap = await admin.database().ref("fcmTokens").get();
  const raw = snap.val() || {};
  const tokensByUid = {};
  for (const [uid, bag] of Object.entries(raw)) {
    if (!bag) continue;
    const list = [];
    for (const [k, v] of Object.entries(bag)) {
      if (v && v.token) {
        list.push({ key: k, ...v });
      }
    }
    if (list.length) tokensByUid[uid] = list;
  }
  return tokensByUid;
}

async function sendPushImpl(data, context) {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Login required.");
  }
  const callerUid = context.auth.uid;
  await assertIsAdmin(callerUid);

  const title = normalizeStr(data?.title, 80) || "Notification";
  const body = normalizeStr(data?.body, 220);
  const link = normalizeStr(data?.link, 400);
  const audience = normalizeStr(data?.audience, 20) || "all";
  const targetUid = normalizeStr(data?.targetUid, 128);

  if (!body) {
    throw new functions.https.HttpsError("invalid-argument", "Body required.");
  }
  if (audience === "user" && !targetUid) {
    throw new functions.https.HttpsError("invalid-argument", "targetUid required for audience=user.");
  }

  const tokensByUid = await readAllTokens();
  const uidsWithTokens = Object.keys(tokensByUid);

  const roles = {};
  await Promise.all(
    uidsWithTokens.map(async (uid) => {
      try {
        roles[uid] = await getRole(uid);
      } catch (_e) {
        roles[uid] = "staff";
      }
    })
  );

  const selectedUids = uidsWithTokens.filter((uid) => {
    if (audience === "all") return true;
    if (audience === "admins") return isAdminRole(roles[uid]);
    if (audience === "team") return !isAdminRole(roles[uid]);
    if (audience === "user") return uid === targetUid;
    return true;
  });

  const tokens = [];
  for (const uid of selectedUids) {
    for (const t of (tokensByUid[uid] || [])) {
      if (t && t.token) tokens.push(String(t.token));
    }
  }

  if (!tokens.length) {
    return { ok: true, sent: 0, failed: 0, totalTokens: 0, audience, note: "No tokens for this audience." };
  }

  const payload = {
    notification: { title, body },
    data: {
      title,
      body,
      link: link || "",
      click_action: link || "",
    },
  };

  let success = 0;
  let failure = 0;

  const batches = chunkArray(tokens, 500);
  for (const batch of batches) {
    const res = await admin.messaging().sendEachForMulticast({ tokens: batch, ...payload });
    success += res.successCount || 0;
    failure += res.failureCount || 0;
  }

  return { ok: true, sent: success, failed: failure, totalTokens: tokens.length, audience };
}

async function getPushAuditImpl(_data, context) {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Login required.");
  }
  await assertIsAdmin(context.auth.uid);

  const [usersSnap, tokensByUid] = await Promise.all([
    admin.database().ref("users").get(),
    readAllTokens(),
  ]);

  const users = usersSnap.val() || {};
  const out = [];

  const allUids = new Set([...Object.keys(users), ...Object.keys(tokensByUid)]);
  for (const uid of allUids) {
    const u = users[uid] || {};
    const role = String(u.role || "staff").toLowerCase() || "staff";
    const name = u.name || u.displayName || u.email || uid;

    const toks = tokensByUid[uid] || [];
    const tokenCount = toks.length;
    let anyStandalone = false;
    let lastTokenAt = 0;
    for (const t of toks) {
      if (t && t.standalone) anyStandalone = true;
      const ts = Number(t && t.updatedAt ? t.updatedAt : 0) || 0;
      if (ts > lastTokenAt) lastTokenAt = ts;
    }

    const client = u.client || {};
    const lastSeenStandaloneAt = Number(client.lastSeenStandaloneAt || 0) || 0;
    const pwaInstalledAt = Number(client.pwaInstalledAt || 0) || 0;

    out.push({
      uid,
      name,
      role,
      tokenCount,
      anyStandalone,
      lastTokenAt,
      lastSeenStandaloneAt,
      pwaInstalledAt,
    });
  }

  out.sort((a, b) => {
    const ar = isAdminRole(a.role) ? 0 : 1;
    const br = isAdminRole(b.role) ? 0 : 1;
    if (ar !== br) return ar - br;
    if (b.tokenCount !== a.tokenCount) return b.tokenCount - a.tokenCount;
    return String(a.name).localeCompare(String(b.name));
  });

  return { generatedAt: Date.now(), users: out };
}

exports.sendPush = functions.region("us-central1").https.onCall(sendPushImpl);
exports.sendPushToAll = functions.region("us-central1").https.onCall((data, context) => sendPushImpl({ ...data, audience: "all" }, context));
exports.getPushAudit = functions.region("us-central1").https.onCall(getPushAuditImpl);
