import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import nodemailer from "nodemailer";

// --- CONFIGURATION ---
const SENDER_EMAIL = '"Pulse App" <no-reply@pulseapp.ovh>';
const LOGO_URL = "https://www.pulseapp.ovh/icon-dark-32x32.png";

// --- HELPER: TEMPLATE EMAIL ---
function getResetPasswordEmailHtml(name: string, email: string, link: string) {
  return `
    <!DOCTYPE html>
    <html style="font-family: sans-serif;">
    <body style="background: #f4f4f5; padding: 40px 0; margin: 0;">
      <div style="max-width: 450px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border: 1px solid #e4e4e7;">
        <div style="background: #000; padding: 30px; text-align: center;">
           <img src="${LOGO_URL}" alt="Pulse" style="height: 50px; width: auto;" />
        </div>
        <div style="padding: 40px 30px; text-align: center; color: #18181b;">
          <h2 style="margin-top: 0; font-size: 20px; font-weight: 700;">Réinitialisation</h2>
          <p style="color: #52525b; margin-bottom: 30px; line-height: 1.5;">
            Une demande de réinitialisation de mot de passe a été effectuée pour le compte de <strong>${name || email}</strong>.
          </p>
          <a href="${link}" style="background: #ea580c; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; display: inline-block;">Changer mon mot de passe</a>
          <p style="margin-top: 30px; font-size: 12px; color: #a1a1aa;">Si vous n'avez pas demandé cette action, ignorez cet email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// --- API ROUTE ---
export async function POST(req: Request) {
  try {
    const { action, uid, email, name } = await req.json();

    // 1. ACTION : RÉINITIALISER MOT DE PASSE (Via Brevo)
    if (action === "reset_password") {
      if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 });

      // SÉCURITÉ : On récupère les variables d'environnement
      const brevoUser = process.env.BREVO_USER;
      const brevoPass = process.env.BREVO_PASS;

      // Si la config manque, on STOPPE tout (ne jamais mettre de clé en dur ici)
      if (!brevoUser || !brevoPass) {
        console.error("❌ [API] Erreur Critique : Configuration SMTP manquante (BREVO_USER/PASS).");
        return NextResponse.json({ error: "Erreur configuration serveur." }, { status: 500 });
      }

      // Génération du lien Firebase
      const link = await adminAuth.generatePasswordResetLink(email);
      
      const transporter = nodemailer.createTransport({
        host: "smtp-relay.brevo.com",
        port: 587, // Port standard (ou 2525)
        secure: false,
        auth: { user: brevoUser, pass: brevoPass },
      });

      const html = getResetPasswordEmailHtml(name, email, link);

      await transporter.sendMail({
        from: SENDER_EMAIL,
        to: email,
        subject: "Réinitialisation de votre mot de passe Pulse App",
        html: html
      });

      return NextResponse.json({ success: true, message: "Email envoyé via Brevo" });
    }

    // 2. ACTION : IMPERSONATE (Se connecter en tant que)
    if (action === "impersonate") {
      if (!uid) return NextResponse.json({ error: "UID requis" }, { status: 400 });

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
