import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin"; // Assurez-vous que adminDb est configuré*

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, userName, userRole, companyId, companyName, action, details } = body;

    // Si adminDb n'est pas dispo (cas rare), on renvoie une erreur
    if (!adminDb) {
        console.error("Admin DB non configuré");
        return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    await adminDb.collection("system_logs").add({
      userId,
      userName,
      userRole,
      companyId,
      companyName,
      action,
      details,
      timestamp: new Date().toISOString(), // Date texte pour tri facile
      createdAt: new Date(), // Date native
      device: "Desktop (API)" // Simplifié pour l'API
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Log Error:", error);
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }
}
