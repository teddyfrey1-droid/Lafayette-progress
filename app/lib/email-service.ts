import nodemailer from "nodemailer";

// --- CONFIGURATION ---
const SENDER_EMAIL = '"Pulse App" <no-reply@pulseapp.ovh>';
const LOGO_URL = "https://www.pulseapp.ovh/icon-dark-32x32.png";

// Validation de la config au chargement du fichier (Fail Fast)
const brevoUser = process.env.BREVO_USER;
const brevoPass = process.env.BREVO_PASS;

if (!brevoUser || !brevoPass) {
  // On logue juste une erreur, on ne plante pas tout le serveur,
  // mais les fonctions d'envoi échoueront proprement.
  console.warn("⚠️ [EmailService] SMTP non configuré (BREVO_USER/PASS manquants).");
}

// Création du transporteur unique
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587, // Port standard sécurisé
  secure: false, 
  auth: { user: brevoUser, pass: brevoPass },
});

// --- TEMPLATES HTML ---

function getBaseHtml(title: string, content: string, callToAction?: { link: string, text: string }) {
  const currentYear = new Date().getFullYear();
  
  // Bouton optionnel
  const btnHtml = callToAction 
    ? `<a href="${callToAction.link}" style="display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; margin-top: 20px;">${callToAction.text}</a>`
    : '';

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

// --- FONCTION D'ENVOI GÉNÉRIQUE ---

export async function sendEmail(to: string, subject: string, html: string) {
  if (!brevoUser || !brevoPass) {
    throw new Error("Service email non configuré (SMTP).");
  }
  
  try {
    await transporter.sendMail({ from: SENDER_EMAIL, to, subject, html });
    console.log(`📧 [EmailService] Email envoyé à ${to}`);
  } catch (error) {
    console.error("❌ [EmailService] Erreur d'envoi:", error);
    throw error; // On relance l'erreur pour que l'API le sache
  }
}

// --- FONCTIONS SPÉCIFIQUES ---

export async function sendWelcomeEmail(email: string, firstName: string, company: string, link: string) {
  const content = `
    Vous avez été invité à rejoindre l'espace <strong>${company || "votre espace"}</strong>.<br>
    Votre compte est prêt à être activé.
  `;
  const html = getBaseHtml(`Bienvenue ${firstName}`, content, { link, text: "Définir mon mot de passe" });
  await sendEmail(email, `Bienvenue sur Pulse App, ${firstName} !`, html);
}

export async function sendResetPasswordEmail(email: string, name: string, link: string) {
  const content = `
    Une demande de réinitialisation de mot de passe a été effectuée pour le compte de <strong>${name || email}</strong>.<br>
    Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
  `;
  const html = getBaseHtml("Réinitialisation", content, { link, text: "Changer mon mot de passe" });
  await sendEmail(email, "Réinitialisation de votre mot de passe Pulse App", html);
}
