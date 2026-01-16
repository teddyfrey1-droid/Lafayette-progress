import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import nodemailer from "nodemailer";

// --- CONFIGURATION EMAIL ---
// Remplacez par votre email d'envoi vérifié sur Brevo
const SENDER_EMAIL = '"Pulse App" <no-reply@pulseapp.ovh>'; 
const LOGO_URL = "https://www.pulseapp.ovh/icon-dark-32x32.png"; // Assurez-vous que cette image est accessible

// --- MÉTHODE POST : INVITER UN UTILISATEUR ---
export async function POST(req: Request) {
  console.log("🚀 [API] Début de la procédure d'invitation");
  
  try {
    const body = await req.json();
    const { email, firstName, lastName, role, contractHours, company } = body;
    
    // Construction du nom complet propre
    const displayName = `${firstName} ${lastName}`.trim();
    
    console.log(`👤 [API] Invitation pour: ${email} (${displayName})`);

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
      firstName,
      lastName,
      role,
      contractHours: Number(contractHours),
      company: company || "Heiko",
      disabled: false,
      lastLogin: null, // Pour savoir s'il est "En attente"
      pushEnabled: false, // Par défaut, en attendant qu'il active sur son mobile
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Génération lien magique
    const actionLink = await adminAuth.generatePasswordResetLink(email);

    // 4. Config SMTP (Port 2525 recommandé pour Brevo/Render)
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 2525, 
      secure: false,
      auth: {
        user: process.env.BREVO_USER || "9f9c88001@smtp-brevo.com", 
        pass: process.env.BREVO_PASS || "bskRITXqoGxtW0X",          
      },
    });

    // 5. Template HTML "Ultra Quali"
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenue sur Pulse App</title>
        <style>
          body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
          .container { max-width: 500px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { background: #09090b; padding: 30px; text-align: center; }
          .logo-container { width: 60px; height: 60px; background: rgba(255,255,255,0.1); border-radius: 14px; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; }
          .app-title { color: #ffffff; font-size: 18px; font-weight: 600; letter-spacing: 0.5px; margin: 0; }
          .content { padding: 40px 30px; text-align: center; color: #3f3f46; }
          .h1 { font-size: 22px; font-weight: 700; color: #18181b; margin-bottom: 16px; }
          .text { font-size: 15px; line-height: 1.6; margin-bottom: 30px; color: #52525b; }
          .btn { display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(234, 88, 12, 0.3); transition: transform 0.2s; }
          .info-box { background-color: #f4f4f5; border-radius: 8px; padding: 15px; margin: 30px 0; text-align: left; font-size: 13px; color: #71717a; }
          .footer { background-color: #fafafa; padding: 20px; text-align: center; font-size: 12px; color: #a1a1aa; border-top: 1px solid #f4f4f5; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-container">
               <img src="${LOGO_URL}" alt="P" width="32" height="32" style="display:block; border:0;" />
            </div>
            <p class="app-title">Pulse App</p>
          </div>
          
          <div class="content">
            <h1 class="h1">Bonjour ${firstName},</h1>
            <p class="text">
              L'équipe <strong>${company || "Heiko"}</strong> vous a invité à rejoindre son espace de pilotage sur Pulse App.
              <br><br>
              Votre compte est prêt. Il ne vous reste plus qu'à définir votre mot de passe pour commencer.
            </p>
            
            <a href="${actionLink}" class="btn">Activer mon compte</a>

            <div class="info-box">
              <strong>Identifiant :</strong> ${email}<br>
              <strong>Rôle :</strong> ${role === 'admin' ? 'Administrateur' : role === 'manager' ? 'Manager' : 'Collaborateur'}
            </div>
          </div>

          <div class="footer">
            &copy; ${new Date().getFullYear()} Pulse App. Tous droits réservés.<br>
            Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
          </div>
        </div>
      </body>
      </html>
    `;

    // 6. Envoi
    await transporter.sendMail({
      from: SENDER_EMAIL,
      to: email,
      subject: `👋 Bienvenue sur Pulse App, ${firstName} !`,
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

// --- MÉTHODE DELETE : SUPPRIMER UN UTILISATEUR ---
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");

    if (!uid) {
      return NextResponse.json({ error: "UID requis" }, { status: 400 });
    }

    console.log(`🗑️ [API] Suppression de l'utilisateur: ${uid}`);

    // 1. Suppression Auth (Empêche la connexion)
    await adminAuth.deleteUser(uid);

    // 2. Suppression Firestore (Supprime les données)
    await adminDb.collection("users").doc(uid).delete();

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("❌ [API] ERREUR SUPPRESSION:", error);
    return NextResponse.json(
      { error: error.message || "Impossible de supprimer l'utilisateur" },
      { status: 500 }
    );
  }
}
