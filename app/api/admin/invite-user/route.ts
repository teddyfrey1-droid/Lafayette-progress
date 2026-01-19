import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import nodemailer from "nodemailer";

// --- CONFIGURATION ---
const SENDER_EMAIL = '"Pulse App" <no-reply@pulseapp.ovh>'; 
// Utilisez le lien vers votre logo (assurez-vous qu'il est de bonne qualité)
const LOGO_URL = "https://www.pulseapp.ovh/icon-dark-32x32.png"; 

// --- POST: INVITER UN UTILISATEUR ---
export async function POST(req: Request) {
  console.log("🚀 [API] Début invitation Pulse App");
  try {
    const body = await req.json();
    const { email, firstName, lastName, role, contractHours, company } = body;
    const displayName = `${firstName} ${lastName}`.trim();
    
    // 1. Auth & Firestore
    const userRecord = await adminAuth.createUser({ email, displayName, emailVerified: true });
    
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid, email, displayName, firstName, lastName, role,
      contractHours: Number(contractHours), company: company || "Heiko",
      disabled: false, lastLogin: null, pushEnabled: false,
      createdAt: new Date(), updatedAt: new Date(),
    });

    // 2. Lien & Email
    const actionLink = await adminAuth.generatePasswordResetLink(email);
    
    // Config SMTP (Port 2525 pour éviter les blocages Render)
    const brevoUser = process.env.BREVO_USER;
    const brevoPass = process.env.BREVO_PASS;
    if (!brevoUser || !brevoPass) {
      console.error('[API] SMTP not configured: missing BREVO_USER/BREVO_PASS');
      return NextResponse.json({ error: 'SMTP non configuré.' }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com", port: 2525, secure: false,
      auth: { user: brevoUser, pass: brevoPass },
    });

    // TEMPLATE EMAIL "PRO" (Logo centré et design épuré)
    const emailHtml = `
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
          <div class="footer">© ${new Date().getFullYear()} Pulse App. Tous droits réservés.</div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({ from: SENDER_EMAIL, to: email, subject: `Bienvenue sur Pulse App, ${firstName} !`, html: emailHtml });
    
    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    console.error("❌ [API] Erreur Invite:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- PATCH: MODIFIER UTILISATEUR (EMAIL INCLUS) ---
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { uid, email, role, contractHours, company } = body;

    console.log(`📝 [API] Mise à jour pour ${uid}`);

    // 1. Mise à jour Auth (Email)
    if (email) {
      await adminAuth.updateUser(uid, { email });
    }

    // 2. Mise à jour Firestore
    const updateData: any = { updatedAt: new Date() };
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (contractHours) updateData.contractHours = Number(contractHours);
    if (company) updateData.company = company;

    await adminDb.collection("users").doc(uid).update(updateData);

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

    await adminAuth.deleteUser(uid);
    await adminDb.collection("users").doc(uid).delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
