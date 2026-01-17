import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import nodemailer from "nodemailer";

// Configuration identique à invite-user
const SENDER_EMAIL = '"Pulse App" <no-reply@pulseapp.ovh>'; 
const LOGO_URL = "https://www.pulseapp.ovh/icon-dark-32x32.png"; 

export async function POST(req: Request) {
  console.log("🚀 [API] Demande de réinitialisation mot de passe");
  
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 });

    // 1. Générer le lien via Admin SDK (Côté serveur)
    const link = await adminAuth.generatePasswordResetLink(email);

    // 2. Configurer Nodemailer (Brevo)
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com", 
      port: 2525, 
      secure: false,
      auth: { 
        user: process.env.BREVO_USER || "9f9c88001@smtp-brevo.com", 
        pass: process.env.BREVO_PASS || "bskRITXqoGxtW0X" 
      },
    });

    // 3. Template Email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <body style="background-color: #f4f4f5; font-family: sans-serif; padding: 40px 0;">
        <div style="max-width: 500px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; text-align: center; border: 1px solid #e4e4e7;">
           <img src="${LOGO_URL}" alt="Pulse" style="width: 40px; margin-bottom: 20px;" />
           <h1 style="font-size: 20px; color: #18181b; margin-bottom: 10px;">Réinitialisation de mot de passe</h1>
           <p style="color: #52525b; margin-bottom: 30px;">
             Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour continuer.
           </p>
           <a href="${link}" style="background-color: #ea580c; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">
             Changer mon mot de passe
           </a>
           <p style="color: #a1a1aa; font-size: 12px; margin-top: 30px;">
             Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
           </p>
        </div>
      </body>
      </html>
    `;

    // 4. Envoi
    await transporter.sendMail({
      from: SENDER_EMAIL,
      to: email,
      subject: "Réinitialisation de votre mot de passe - Pulse App",
      html: emailHtml,
    });

    console.log(`✅ [API] Email de reset envoyé à ${email} via Brevo`);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("❌ [API] Erreur Reset Password:", error);
    // On renvoie une erreur générique pour ne pas fuiter d'infos, mais on loggue le vrai problème
    return NextResponse.json({ error: "Impossible d'envoyer l'email." }, { status: 500 });
  }
}
