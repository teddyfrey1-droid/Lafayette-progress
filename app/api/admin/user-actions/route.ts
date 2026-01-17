import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import nodemailer from "nodemailer";

// --- CONFIG EMAIL ---
const SENDER_EMAIL = '"Pulse App" <no-reply@pulseapp.ovh>'; 
const LOGO_URL = "https://www.pulseapp.ovh/icon-dark-32x32.png"; 

export async function POST(req: Request) {
  try {
    const { action, uid, email, name } = await req.json();

    // 1. ACTION : RÉINITIALISER MOT DE PASSE (Via Brevo)
    if (action === "reset_password") {
      const link = await adminAuth.generatePasswordResetLink(email);
      
      const transporter = nodemailer.createTransport({
        host: "smtp-relay.brevo.com", port: 2525, secure: false,
        auth: { user: process.env.BREVO_USER || "9f9c88001@smtp-brevo.com", pass: process.env.BREVO_PASS || "bskRITXqoGxtW0X" },
      });

      const html = `
        <!DOCTYPE html>
        <html style="font-family: sans-serif;">
        <body style="background: #f4f4f5; padding: 40px 0;">
          <div style="max-width: 450px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
            <div style="background: #000; padding: 30px; text-align: center;">
               <img src="${LOGO_URL}" alt="Pulse" style="height: 50px; width: auto;" />
            </div>
            <div style="padding: 40px 30px; text-align: center; color: #333;">
              <h2 style="margin-top: 0;">Réinitialisation</h2>
              <p style="color: #666; margin-bottom: 30px;">
                Une demande de réinitialisation de mot de passe a été effectuée pour le compte de <strong>${name || email}</strong>.
              </p>
              <a href="${link}" style="background: #ea580c; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">Changer mon mot de passe</a>
            </div>
          </div>
        </body>
        </html>
      `;

      await transporter.sendMail({
        from: SENDER_EMAIL, to: email,
        subject: "Réinitialisation de votre mot de passe Pulse App",
        html: html
      });

      return NextResponse.json({ success: true, message: "Email envoyé via Brevo" });
    }

    // 2. ACTION : IMPERSONATE (Se connecter en tant que)
    if (action === "impersonate") {
      // Crée un token temporaire qui permet au Super Admin de devenir cet utilisateur
      const token = await adminAuth.createCustomToken(uid);
      return NextResponse.json({ success: true, token });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });

  } catch (error: any) {
    console.error("❌ Erreur Admin Action:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
