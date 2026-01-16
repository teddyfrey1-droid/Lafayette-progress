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
    console.log(`✅ [API] Utilisateur créé (UID: ${userRecord.uid})`);

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

    // 3. Génération lien
    const actionLink = await adminAuth.generatePasswordResetLink(email);
    console.log("✅ [API] Lien généré");

    // 4. Configuration Nodemailer (Port 2525 pour éviter le blocage)
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 2525, // <--- CHANGEMENT ICI (était 587)
      secure: false,
      auth: {
        user: "9f9c88001@smtp-brevo.com", 
        pass: "bskRITXqoGxtW0X",          
      },
      // Timeout plus court pour ne pas attendre indéfiniment en cas de problème
      connectionTimeout: 10000, 
    });

    // 5. Envoi de l'email
    console.log("📨 [API] Envoi en cours via le port 2525...");
    
    await transporter.sendMail({
      from: '"Lafayette Progress" <no-reply@pulseapp.ovh>', // Mettez une adresse pro, pas gmail
      to: email,
      subject: "Bienvenue sur Lafayette Progress - Activez votre compte",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333;">Bienvenue ${displayName} !</h2>
          <p>Un compte a été créé pour vous.</p>
          <p>Cliquez ci-dessous pour définir votre mot de passe et accéder à l'espace :</p>
          <br>
          <a href="${actionLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Activer mon compte maintenant
          </a>
          <br><br>
          <p style="font-size: 12px; color: #888;">Si le bouton ne fonctionne pas, copiez ce lien : ${actionLink}</p>
        </div>
      `,
    });
    
    console.log("🚀 [API] SUCCÈS : Mail envoyé !");

    return NextResponse.json({ success: true, uid: userRecord.uid });

  } catch (error: any) {
    console.error("❌ [API] ERREUR:", error);
    return NextResponse.json(
      { error: error.message || "Erreur interne" },
      { status: 500 }
    );
  }
}
