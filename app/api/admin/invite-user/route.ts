import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import nodemailer from "nodemailer";

// --- CONFIGURATION ---
const SENDER_EMAIL = '"Pulse App" <no-reply@pulseapp.ovh>';
const LOGO_URL = "https://www.pulseapp.ovh/icon-dark-32x32.png";

// --- HELPER: TEMPLATE EMAIL ---
// Sortir le HTML rend le code principal plus lisible
function getWelcomeEmailHtml(firstName: string, company: string, actionLink: string) {
  const currentYear = new Date().getFullYear();
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; }
        .container { max-width: 500px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e4e4e7; }
        .header { background: #000000; padding: 40px 0; text-align: center; }
        .logo { display: block; margin: 0 auto; max-height: 60px; width: auto; }
        .content { padding: 40px 30px; text-align: center; color: #18181b; }
        .h1 { font-size: 24px; font-weight: 700; margin: 0 0 20px 0; color: #18181b; }
        .text { font-size: 16px; line-height: 1.6; color: #52525b; margin-bottom: 30px; }
        .btn { display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; margin-top: 10px; }
        .footer { background: #fafafa; padding: 20px; text-align: center; font-size: 12px; color: #a1a1aa; border-top: 1px solid #f4f4f5; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
           <img src="${LOGO_URL}" alt="Pulse App" class="logo" />
           <p style="color: #666; font-size: 12px; margin-top: 10px; text-transform: uppercase; letter-spacing: 2px;">Pulse App</p>
        </div>
        <div class="content">
          <h1 class="h1">Bienvenue ${firstName}</h1>
          <p class="text">
            Vous avez été invité à rejoindre l'espace <strong>${company || "Heiko"}</strong>.
            <br>Votre compte est prêt à être activé.
          </p>
          <a href="${actionLink}" class="btn">Définir mon mot de passe</a>
        </div>
        <div class="footer">© ${currentYear} Pulse App. Tous droits réservés.</div>
      </div>
    </body>
    </html>
  `;
}

// --- POST: INVITER UN UTILISATEUR ---
export async function POST(req: Request) {
  console.log("🚀 [API] Début invitation Pulse App");

  // Validation Config SMTP avant tout traitement (Fail Fast)
  const brevoUser = process.env.BREVO_USER;
  const brevoPass = process.env.BREVO_PASS;

  if (!brevoUser || !brevoPass) {
    console.error('❌ [API] SMTP Critical: missing BREVO_USER/BREVO_PASS');
    return NextResponse.json({ error: 'Configuration serveur incomplète (SMTP).' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { email, firstName, lastName, role, contractHours, company } = body;
    
    // Validation basique des champs requis
    if (!email || !firstName || !lastName) {
      return NextResponse.json({ error: "Email, Prénom et Nom sont requis." }, { status: 400 });
    }

    const displayName = `${firstName} ${lastName}`.trim();

    // 1. Auth & Firestore
    const userRecord = await adminAuth.createUser({ 
      email, 
      displayName, 
      emailVerified: true 
    });

    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      firstName,
      lastName,
      role: role || "user", // Valeur par défaut si manquant
      contractHours: Number(contractHours) || 0,
      company: company || "Heiko",
      disabled: false,
      lastLogin: null,
      pushEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Génération du lien magique
    const actionLink = await adminAuth.generatePasswordResetLink(email);

    // 3. Envoi Email
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587, // Port standard sécurisé (ou 2525 si 587 bloqué)
      secure: false, // true pour 465, false pour les autres ports
      auth: { user: brevoUser, pass: brevoPass },
    });

    const emailHtml = getWelcomeEmailHtml(firstName, company, actionLink);

    await transporter.sendMail({
      from: SENDER_EMAIL,
      to: email,
      subject: `Bienvenue sur Pulse App, ${firstName} !`,
      html: emailHtml,
    });

    console.log(`✅ [API] Invitation envoyée à ${email}`);
    return NextResponse.json({ success: true, uid: userRecord.uid });

  } catch (error: any) {
    console.error("❌ [API] Erreur Invite:", error);
    // On renvoie le message d'erreur spécifique (ex: email déjà utilisé)
    return NextResponse.json({ error: error.message || "Erreur serveur" }, { status: 500 });
  }
}

// --- PATCH: MODIFIER UTILISATEUR ---
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { uid, email, firstName, lastName, role, contractHours, company } = body;

    if (!uid) return NextResponse.json({ error: "UID requis" }, { status: 400 });

    console.log(`📝 [API] Mise à jour demandée pour ${uid}`);

    // --- 1. Préparation des mises à jour ---
    const firestoreUpdates: any = { updatedAt: new Date() };
    const authUpdates: any = {};

    // Helper pour mettre à jour conditionnellement
    if (email) {
      firestoreUpdates.email = email;
      authUpdates.email = email;
    }
    if (firstName) firestoreUpdates.firstName = firstName;
    if (lastName) firestoreUpdates.lastName = lastName;
    
    // Recalcul du displayName uniquement si nécessaire
    if (firstName || lastName) {
      // On doit récupérer les anciennes valeurs si l'un des deux manque, 
      // mais ici on suppose que le front envoie souvent le set complet.
      // Pour simplifier, on construit le displayName avec ce qu'on a.
      const newDisplayName = `${firstName || ""} ${lastName || ""}`.trim();
      if (newDisplayName) {
        firestoreUpdates.displayName = newDisplayName;
        authUpdates.displayName = newDisplayName;
      }
    }

    if (role) firestoreUpdates.role = role;
    if (contractHours !== undefined) firestoreUpdates.contractHours = Number(contractHours);
    if (company) firestoreUpdates.company = company;

    // --- 2. Exécution ---
    const promises = [];

    // Mise à jour Auth seulement si nécessaire
    if (Object.keys(authUpdates).length > 0) {
      promises.push(adminAuth.updateUser(uid, authUpdates));
    }

    // Mise à jour Firestore toujours requise (pour updatedAt)
    promises.push(adminDb.collection("users").doc(uid).update(firestoreUpdates));

    await Promise.all(promises);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ [API] Erreur Update:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- DELETE: SUPPRIMER UTILISATEUR ---
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");

    if (!uid) return NextResponse.json({ error: "UID requis" }, { status: 400 });

    console.log(`🗑️ [API] Suppression de l'utilisateur ${uid}`);

    // Exécution en parallèle pour gagner du temps
    await Promise.all([
      adminAuth.deleteUser(uid),
      adminDb.collection("users").doc(uid).delete()
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ [API] Erreur Delete:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
