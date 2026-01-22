import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { UserRole } from "@/lib/rbac-schema"; // Import des types

// Firebase Admin requiert l'environnement Node.js (pas Edge)
export const runtime = "nodejs";

// --- Sécurité (optionnelle) ---
// Pour activer : INVITE_USER_REQUIRE_AUTH=true
// Optionnellement, pour vérifier un secret statique : INVITE_USER_BEARER_TOKEN="..."
function enforceAuthIfEnabled(req: Request) {
  const requireAuth = process.env.INVITE_USER_REQUIRE_AUTH === "true";
  if (!requireAuth) return null;

  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ") || auth.length <= "Bearer ".length) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expected = process.env.INVITE_USER_BEARER_TOKEN;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

// --- Email via Brevo HTTP API ---
const SENDER_NAME = "Pulse App";
const SENDER_EMAIL = "no-reply@pulseapp.ovh";
const LOGO_URL = "https://www.pulseapp.ovh/icon-dark-32x32.png";

function getBaseHtml(
  title: string,
  content: string,
  callToAction?: { link: string; text: string }
) {
  const currentYear = new Date().getFullYear();
  const btnHtml = callToAction
    ? `<a href="${callToAction.link}" style="display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; margin-top: 20px;">${callToAction.text}</a>`
    : "";

  return `
    <!DOCTYPE html>
    <html style="font-family: sans-serif;">
    <body style="background: #f4f4f5; padding: 40px 0; margin: 0;">
      <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e4e4e7;">
        <div style="background: #000000; padding: 30px 0; text-align: center;">
           <img src="${LOGO_URL}" alt="Pulse App" style="display: block; margin: 0 auto; max-height: 50px; width: auto;" />
        </div>
        <div style="padding: 40px 30px; text-align: center; color: #18181b;">
          <h2 style="font-size: 24px; font-weight: 700; margin: 0 0 20px 0;">${title}</h2>
          <div style="font-size: 16px; line-height: 1.6; color: #52525b; margin-bottom: 30px;">
            ${content}
          </div>
          ${btnHtml}
        </div>
        <div style="background: #fafafa; padding: 20px; text-align: center; font-size: 12px; color: #a1a1aa; border-top: 1px solid #f4f4f5;">
          © ${currentYear} Pulse App.
        </div>
      </div>
    </body>
    </html>
  `;
}

async function sendBrevoEmail(params: {
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error("BREVO_API_KEY manquant");
  }

  const controller = new AbortController();
  // Garder une marge sous les timeouts Serverless
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
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: params.toEmail, name: params.toName || params.toEmail }],
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

async function sendBrevoWelcomeEmail(email: string, firstName: string, company: string, link: string) {
  const content = `
    Vous avez été invité à rejoindre l'espace <strong>${company || "votre espace"}</strong>.<br>
    Votre compte est prêt à être activé.
  `;
  const html = getBaseHtml(`Bienvenue ${firstName}`, content, {
    link,
    text: "Définir mon mot de passe",
  });

  await sendBrevoEmail({
    toEmail: email,
    toName: firstName,
    subject: `Bienvenue sur Pulse App, ${firstName} !`,
    htmlContent: html,
  });
}

export async function POST(req: Request) {
  console.log("🚀 [API] Début invitation Pulse App");

  const authResp = enforceAuthIfEnabled(req);
  if (authResp) return authResp;

  try {
    const body = await req.json();
    const { email, firstName, lastName, role, contractHours, company } = body;

    if (!email || !firstName || !lastName) {
      return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 });
    }

    const displayName = `${firstName} ${lastName}`.trim();
    
    // 1. Auth : Création du compte
    const userRecord = await adminAuth.createUser({ email, displayName, emailVerified: true });
    
    // 2. Firestore : Sauvegarde avec Type sécurisé pour le rôle
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      firstName,
      lastName,
      // Utilisation de l'Enum (fallback sur EMPLOYEE si invalide ou vide)
      role: Object.values(UserRole).includes(role) ? role : UserRole.EMPLOYEE,
      contractHours: Number(contractHours) || 0,
      company: company || "Heiko",
      disabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Email : Envoi via API Brevo (HTTP)
    const actionLink = await adminAuth.generatePasswordResetLink(email);

    // L'utilisateur est déjà créé : si l'email échoue, on log mais on ne fait pas échouer la requête.
    let emailSent = false;
    try {
      await sendBrevoWelcomeEmail(email, firstName, company, actionLink);
      emailSent = true;
    } catch (err) {
      console.error("⚠️ [API] Email d'invitation non envoyé (Brevo):", err);
    }

    return NextResponse.json({ success: true, uid: userRecord.uid, emailSent });

  } catch (error: any) {
    console.error("❌ [API] Erreur Invite:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH et DELETE restent inchangés sauf pour l'usage de UserRole si vous voulez le typer strictement.
// Pour l'instant, seul POST était critique pour le refactoring email.
export async function PATCH(req: Request) {
    // ... (Votre code PATCH existant, rien de critique à changer ici pour l'instant)
    // Copiez votre fonction PATCH actuelle ici
    try {
        const authResp = enforceAuthIfEnabled(req);
        if (authResp) return authResp;

        const body = await req.json();
        const { uid, email, firstName, lastName, role, contractHours, company } = body;
    
        // ... (Logique Auth update) ...
        const authUpdates: any = {};
        if (email) authUpdates.email = email;
        if (firstName || lastName) {
             const newDisplayName = `${firstName || ""} ${lastName || ""}`.trim();
             if (newDisplayName) authUpdates.displayName = newDisplayName;
        }
        if (Object.keys(authUpdates).length > 0) await adminAuth.updateUser(uid, authUpdates);

        // ... (Logique Firestore update) ...
        const updateData: any = { updatedAt: new Date() };
        if (email) updateData.email = email;
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (firstName || lastName) updateData.displayName = `${firstName || ""} ${lastName || ""}`.trim();
        if (role) updateData.role = role; // Idéalement valider avec UserRole ici aussi
        if (contractHours !== undefined) updateData.contractHours = Number(contractHours);
        if (company) updateData.company = company;
    
        await adminDb.collection("users").doc(uid).update(updateData);
    
        return NextResponse.json({ success: true });
      } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
}

export async function DELETE(req: Request) {
    // ... (Votre code DELETE existant)
    try {
        const authResp = enforceAuthIfEnabled(req);
        if (authResp) return authResp;

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
