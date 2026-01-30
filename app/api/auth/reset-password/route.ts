import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

// Firebase Admin requiert l'environnement Node.js (pas Edge)
export const runtime = "nodejs";

// Configuration identique à invite-user
const LOGO_URL = "https://www.pulseapp.ovh/icon-dark-32x32.png"; 

async function sendBrevoEmail(params: {
  toEmail: string;
  subject: string;
  htmlContent: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY manquant");

  const controller = new AbortController();
  // marge sous les timeouts serverless
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: "Pulse App", email: "no-reply@pulseapp.ovh" },
        to: [{ email: params.toEmail, name: params.toEmail }],
        subject: params.subject,
        htmlContent: params.htmlContent,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`Brevo API error (${res.status}): ${errorText || res.statusText}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  console.log("🚀 [API] Demande de réinitialisation mot de passe");
  
  try {
    const body = await req.json().catch(() => ({} as any));
    const email = typeof (body as any)?.email === "string" ? (body as any).email.trim() : "";
    if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 });

    // 1. Générer le lien via Admin SDK (Côté serveur)
    let link: string;
    try {
      link = await adminAuth.generatePasswordResetLink(email);
    } catch (err: any) {
      const code = err?.code || err?.errorInfo?.code;
      // Ne pas révéler si l'email existe ou non (anti-enumeration)
      if (code === 'auth/user-not-found') {
        console.log(`[API] reset-password: user not found for ${email} (success returned)`);
        return NextResponse.json({ success: true });
      }
      throw err;
    }

    // 2. Template Email
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

    // 3. Envoi via API Brevo (HTTP)
    await sendBrevoEmail({
      toEmail: email,
      subject: "Réinitialisation de votre mot de passe - Pulse App",
      htmlContent: emailHtml,
    });

    console.log(`✅ [API] Email de reset envoyé à ${email} via Brevo`);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("❌ [API] Erreur Reset Password:", error);
    // On renvoie une erreur générique pour ne pas fuiter d'infos, mais on loggue le vrai problème
    return NextResponse.json({ error: "Impossible d'envoyer l'email." }, { status: 500 });
  }
}
