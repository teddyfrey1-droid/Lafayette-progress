import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { sendResetPasswordEmail } from "@/lib/email-service";

export async function POST(req: Request) {
  try {
    const { action, uid, email, name } = await req.json();

    // 1. ACTION : RÉINITIALISER MOT DE PASSE
    if (action === "reset_password") {
      if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 });

      // Génération du lien
      const link = await adminAuth.generatePasswordResetLink(email);
      
      // Envoi via le Service centralisé (Plus de mot de passe en dur ici !)
      await sendResetPasswordEmail(email, name, link);

      return NextResponse.json({ success: true, message: "Email envoyé" });
    }

    // 2. ACTION : IMPERSONATE
    if (action === "impersonate") {
      if (!uid) return NextResponse.json({ error: "UID requis" }, { status: 400 });

      const token = await adminAuth.createCustomToken(uid);
      return NextResponse.json({ success: true, token });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });

  } catch (error: any) {
    console.error("❌ Erreur Admin Action:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
