import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  console.log("🚀 [API] Début de la procédure d'invitation");
  
  try {
    const body = await req.json();
    const { email, displayName, role, contractHours, company } = body;
    console.log(`👤 [API] Données reçues pour: ${email}`);

    // 1. Création Auth
    const userRecord = await adminAuth.createUser({
      email,
      displayName,
      emailVerified: true,
    });
    console.log(`✅ [API] Utilisateur créé dans Auth (UID: ${userRecord.uid})`);

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
    console.log("✅ [API] Profil Firestore créé");

    // 3. Génération lien
    const actionLink = await adminAuth.generatePasswordResetLink(email);
    console.log("✅ [API] Lien de reset généré");

    // 4. Configuration Nodemailer (Mode Debug activé)
    // NOTE : Assurez-vous que ces identifiants sont EXACTEMENT ceux de votre fichier test-brevo.js qui marchait
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: "9f9c88001@smtp-brevo.com", 
        pass: "bskRITXqoGxtW0X",          
      },
      debug: true, // Affiche les logs SMTP détaillés
      logger: true // Log dans la console
    });

    // 5. Vérification de la connexion AVANT l'envoi
    try {
      await transporter.verify();
      console.log("🔌 [API] Connexion SMTP Brevo : OK");
    } catch (verifyError: any) {
      console.error("❌ [API] Erreur connexion SMTP :", verifyError.message);
      throw new Error("Impossible de se connecter à Brevo: " + verifyError.message);
    }

    // 6. Envoi de l'email
    console.log("📨 [API] Tentative d'envoi du mail...");
    const info = await transporter.sendMail({
      from: '"Lafayette Progress" <teddy.frey1@gmail.com>',
      to: email,
      subject: "Bienvenue sur Lafayette Progress - Activez votre compte",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Bienvenue ${displayName} !</h2>
          <p>Cliquez ci-dessous pour définir votre mot de passe :</p>
          <a href="${actionLink}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Activer mon compte
          </a>
        </div>
      `,
    });
    
    console.log("🚀 [API] Mail envoyé ! MessageID:", info.messageId);

    return NextResponse.json({ success: true, uid: userRecord.uid });

  } catch (error: any) {
    console.error("❌ [API] ERREUR CRITIQUE:", error);
    // On renvoie une erreur 500 pour que le frontend affiche "Erreur" au lieu de "Succès"
    return NextResponse.json(
      { error: error.message || "Erreur interne" },
      { status: 500 }
    );
  }
}
