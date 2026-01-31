import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = (body?.sessionId || "").toString();
    const endToken = (body?.endToken || "").toString();

    if (!sessionId || !endToken) {
      return NextResponse.json({ error: "Missing sessionId/endToken" }, { status: 400 });
    }

    const ref = adminDb.collection("user_sessions").doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const data = snap.data() as any;
    if (data?.endToken !== endToken) {
      return NextResponse.json({ error: "Invalid endToken" }, { status: 403 });
    }

    // Already closed
    if (data?.endedAt) {
      return NextResponse.json({ success: true, alreadyClosed: true });
    }

    const nowIso = new Date().toISOString();
    const startedAt = data?.startedAt ? new Date(data.startedAt) : null;
    const durationSec = startedAt ? Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000)) : null;

    await ref.update({
      endedAt: nowIso,
      durationSec,
      endReason: "client_end",
      updatedAt: nowIso,
    });

    // Log end of session for historical timeline
    await adminDb.collection("system_logs").add({
      userId: data?.userId || "",
      userName: data?.userName || "",
      userRole: data?.userRole || "",
      companyId: data?.companyId || "",
      companyName: data?.companyName || "",
      action: "LOGOUT",
      details: durationSec != null ? `Fin de session (${Math.round(durationSec / 60)} min)` : "Fin de session",
      timestamp: nowIso,
      createdAt: new Date(),
      device: data?.device || "",
      ip: data?.ip || null,
      userAgent: data?.userAgent || "",
      sessionId,
    });

    return NextResponse.json({ success: true, durationSec });
  } catch (error) {
    console.error("end-session error", error);
    return NextResponse.json({ error: "End session failed" }, { status: 500 });
  }
}
