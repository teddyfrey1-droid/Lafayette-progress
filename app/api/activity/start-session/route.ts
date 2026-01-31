import { NextResponse } from "next/server";
import crypto from "crypto";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function maskIp(ip?: string | null): string | null {
  if (!ip) return null;
  // x-forwarded-for may contain multiple IPs
  const first = ip.split(",")[0]?.trim();
  if (!first) return null;
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(first)) {
    const parts = first.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  // IPv6: keep first 3 hextets
  if (first.includes(":")) {
    const p = first.split(":").filter(Boolean);
    return p.slice(0, 3).join(":") + "::";
  }
  return first;
}

function deviceLabel(userAgent: string): string {
  const ua = (userAgent || "").toLowerCase();
  const isMobile = /iphone|ipad|ipod|android|mobile/.test(ua);
  return isMobile ? "Mobile" : "Desktop";
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const userSnap = await adminDb.collection("users").doc(uid).get();
    const u = userSnap.exists ? userSnap.data() || {} : {};

    const userName = (u.displayName || decoded.name || decoded.email || "Utilisateur").toString();
    const userRole = (u.role || "employee").toString();
    const companyId = (u.companyId || "").toString();
    const companyName = (u.companyName || u.company || "").toString();

    const userAgent = request.headers.get("user-agent") || "";
    const ipRaw = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
    const ip = maskIp(ipRaw);
    const device = deviceLabel(userAgent);

    const nowIso = new Date().toISOString();

    // Auto-close previous open sessions for this user (best-effort)
    try {
      const openSnap = await adminDb
        .collection("user_sessions")
        .where("userId", "==", uid)
        .where("endedAt", "==", null)
        .orderBy("startedAt", "desc")
        .limit(3)
        .get();

      if (!openSnap.empty) {
        const batch = adminDb.batch();
        openSnap.docs.forEach((d) => {
          const data = d.data() as any;
          const startedAt = data?.startedAt ? new Date(data.startedAt) : null;
          const durationSec = startedAt ? Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000)) : null;
          batch.update(d.ref, {
            endedAt: nowIso,
            durationSec,
            endReason: "auto_closed_on_new_login",
            updatedAt: nowIso,
          });
        });
        await batch.commit();
      }
    } catch {
      // ignore
    }

    const endToken = crypto.randomBytes(24).toString("hex");

    const sessionRef = await adminDb.collection("user_sessions").add({
      userId: uid,
      userName,
      userRole,
      companyId,
      companyName,
      startedAt: nowIso,
      endedAt: null,
      durationSec: null,
      endToken,
      device,
      userAgent,
      ip,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // Also log the login event in system_logs so existing UI keeps working
    await adminDb.collection("system_logs").add({
      userId: uid,
      userName,
      userRole,
      companyId,
      companyName,
      action: "LOGIN",
      details: "Connexion",
      timestamp: nowIso,
      createdAt: new Date(),
      device,
      ip,
      userAgent,
      sessionId: sessionRef.id,
    });

    return NextResponse.json({ sessionId: sessionRef.id, endToken });
  } catch (error) {
    console.error("start-session error", error);
    return NextResponse.json({ error: "Start session failed" }, { status: 500 });
  }
}
