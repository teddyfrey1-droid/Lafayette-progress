import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  console.log("🚀 DÉMARRAGE: Tentative d'envoi d'email...");

  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.BREVO_USER,
      pass: process.env.BREVO_PASS,
    },
  });

  if (!admin.apps.length) {
    try {
      const keyString = (process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "").replace(/\\n/g, '\n');
      const serviceAccount = JSON.parse(Buffer.from(keyString, "base64").toString("utf-8"));
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log("✅ Firebase Admin connecté.");
    } catch (error) {
      console.error("❌ ERREUR Firebase Admin:", error);
    }
  }

  try {
    const body = await req.json();
    const { email, name, role, companyName, contractHours } = body;
    console.log(`👤 Traitement pour: ${email}`);

    // Création Firebase
    const userRecord = await admin.auth().createUser({ email, displayName: name });
    await admin.firestore().collection("users").doc(userRecord.uid).set({
      displayName: name, email, role, companyName, contractHours, createdAt: admin.firestore.FieldValue.serverTimestamp(), disabled: false
    });

    const link = await admin.auth().generatePasswordResetLink(email);
    console.log(`📨 Envoi via Brevo vers ${email}...`);
    
    await transporter.sendMail({
      from: "teddy.frey1@gmail.com",
      to: email,
      subject: "Bienvenue sur Pulse App",
      html: `<div style="font-family:sans-serif;padding:20px;"><h2>Bienvenue ${name} !</h2><p>Cliquez ici pour choisir votre mot de passe :</p><a href="${link}" style="background:#ea580c;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Activer mon compte</a></div>`,
    });

    console.log("✅ SUCCÈS : Email envoyé !");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ ERREUR FATALE:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}