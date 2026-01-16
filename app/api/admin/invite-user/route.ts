import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  console.log("🚀 [API] Début invitation Pulse App");
  
  try {
    const body = await req.json();
    const { email, displayName, role, contractHours, company } = body;
    
    // 1. Création Auth
    const userRecord = await adminAuth.createUser({
      email,
      displayName,
      emailVerified: true,
    });

    // 2. Création Firestore
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      role,
      contractHours: Number(contractHours),
      company: company || "Heiko",
      disabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Génération lien magique
    const actionLink = await adminAuth.generatePasswordResetLink(email);

    // 4. Config SMTP (Port 2525 pour passer les pare-feux)
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 2525,
      secure: false,
      auth: {
        user: "9f9c88001@smtp-brevo.com", 
        pass: "bskRITXqoGxtW0X",          
      },
    });

    // 5. Template HTML "Beau Gosse" 
    // On utilise une mise en page type "Carte" centrée avec le logo.
    // Note: Pour le logo, assurez-vous que l'image est accessible publiquement.
    const logoUrl = "https://www.pulseapp.ovh/icon-dark-32x32.png"; 

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; }
          .container { max-width: 480px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #000000 0%, #333333 100%); padding: 32px; text-align: center; }
          .logo { width: 64px; height: 64px; background-color: white; border-radius: 12px; padding: 8px; margin-bottom: 8px; display: inline-block; }
          .app-name { color: white; font-size: 20px; font-weight: bold; margin: 0; letter-spacing: 0.5px; }
          .content { padding: 40px 32px; text-align: center; color: #18181b; }
          .h1 { font-size: 24px; font-weight: 700; margin-bottom: 16px; color: #09090b; }
          .text { font-size: 16px; line-height: 1.6; color: #52525b; margin-bottom: 32px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; transition: opacity 0.2s; box-shadow: 0 2px 4px rgba(234, 88, 12, 0.2); }
          .btn:hover { opacity: 0.9; }
          .footer { background-color: #f4f4f5; padding: 24px; text-align: center; font-size: 12px; color: #a1a1aa; border-top: 1px solid #e4e4e7; }
          .link-fallback { margin-top: 24px; font-size: 12px; color: #71717a; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="app-name">Pulse App</div>
          </div>
          <div class="content">
            <h1 class="h1">Bienvenue ${displayName} !</h1>
            <p class="text">
              Votre compte a été créé avec succès. Vous faites maintenant partie de l'équipe <strong>${company || "Heiko"}</strong>.
              <br><br>
              Pour commencer, cliquez ci-dessous afin de définir votre mot de passe sécurisé.
            </p>
            <a href="${actionLink}" class="btn">Activer mon compte</a>
            
            <div class="link-fallback">
              Si le bouton ne fonctionne pas, copiez ce lien :<br>
              <a href="${actionLink}" style="color: #ea580c;">${actionLink}</a>
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Pulse App. Tous droits réservés.<br>
            Cet email est automatique, merci de ne pas y répondre.
          </div>
        </div>
      </body>
      </html>
    `;

    // 6. Envoi avec le nouveau nom et le design
    await transporter.sendMail({
      from: '"Pulse App" <no-reply@pulseapp.ovh>', // Nom propre + Domaine du site
      to: email,
      subject: "Bienvenue sur Pulse App 🚀",
      html: emailHtml,
    });
    
    console.log("🚀 [API] Mail envoyé avec succès !");

    return NextResponse.json({ success: true, uid: userRecord.uid });

  } catch (error: any) {
    console.error("❌ [API] ERREUR:", error);
    return NextResponse.json(
      { error: error.message || "Erreur interne" },
      { status: 500 }
    );
  }
}
