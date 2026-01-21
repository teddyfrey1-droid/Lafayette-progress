import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import nodemailer from "nodemailer";
import { isAtLeast, normalizeRole } from "@/lib/identity";

// --- CONFIG EMAIL ---
const SENDER_EMAIL = '"Pulse App" <no-reply@pulseapp.ovh>';
const LOGO_URL = "https://www.pulseapp.ovh/icon-dark-32x32.png";

type Session = { uid: string; role: string; tenantKey: string };

function getTenantFromUserData(data: any): string {
  return String(data?.companyId || data?.company || "default");
}

async function requireCaller(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return { error: NextResponse.json({ error: "Authentification requise" }, { status: 401 }) } as const;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(m[1]);
    const snap = await adminDb.collection("users").doc(decoded.uid).get();
    const data: any = snap.exists ? snap.data() : {};
    const role = normalizeRole(data?.role);
    const tenantKey = getTenantFromUserData(data);
    return { uid: decoded.uid, role, tenantKey } as const;
  } catch {
    return { error: NextResponse.json({ error: "Token invalide" }, { status: 401 }) } as const;
  }
}

async function isSameTenantOrSuperAdmin(session: Session, targetUid: string): Promise<boolean> {
  if (normalizeRole(session.role) === "super_admin") return true;
  try {
    const snap = await adminDb.collection("users").doc(targetUid).get();
    if (!snap.exists) return false;
    const data: any = snap.data();
    const targetTenant = getTenantFromUserData(data);
    return String(targetTenant) === String(session.tenantKey);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const session = await requireCaller(req);
  if ("error" in session) return session.error;

  try {
    const body = (await req.json().catch(() => ({} as any))) as any;
    const action = typeof body.action === "string" ? body.action : "";
    const uid = typeof body.uid === "string" ? body.uid : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const name = typeof body.name === "string" ? body.name : "";

    const callerRole = session.role;

    // 1. ACTION : RÉINITIALISER MOT DE PASSE (via SMTP)
    if (action === "reset_password") {
      if (!isAtLeast(callerRole, "admin")) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 });

      // Anti-enumeration + tenant gate
      let targetUid = "";
      try {
        const user = await adminAuth.getUserByEmail(email);
        targetUid = user.uid;
      } catch (err: any) {
        const code = err?.code || err?.errorInfo?.code;
        if (code === "auth/user-not-found") {
          return NextResponse.json({ success: true, message: "Demande prise en compte" });
        }
        throw err;
      }

      const allowed = await isSameTenantOrSuperAdmin(session as Session, targetUid);
      if (!allowed) {
        // Ne pas révéler d'information sur l'existence / le tenant.
        return NextResponse.json({ success: true, message: "Demande prise en compte" });
      }

      let link: string;
      try {
        link = await adminAuth.generatePasswordResetLink(email);
      } catch (err: any) {
        const code = err?.code || err?.errorInfo?.code;
        if (code === "auth/user-not-found") {
          return NextResponse.json({ success: true, message: "Demande prise en compte" });
        }
        throw err;
      }

      const brevoUser = process.env.BREVO_USER;
      const brevoPass = process.env.BREVO_PASS;
      if (!brevoUser || !brevoPass) {
        return NextResponse.json({ error: "SMTP non configuré" }, { status: 500 });
      }

      const transporter = nodemailer.createTransport({
        host: "smtp-relay.brevo.com",
        port: 2525,
        secure: false,
        auth: { user: brevoUser, pass: brevoPass },
      });

      const html = `
        <!DOCTYPE html>
        <html style="font-family: sans-serif;">
        <body style="background: #f4f4f5; padding: 40px 0;">
          <div style="max-width: 450px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
            <div style="background: #000; padding: 30px; text-align: center;">
               <img src="${LOGO_URL}" alt="Pulse" style="height: 50px; width: auto;" />
            </div>
            <div style="padding: 40px 30px; text-align: center; color: #333;">
              <h2 style="margin-top: 0;">Réinitialisation</h2>
              <p style="color: #666; margin-bottom: 30px;">
                Une demande de réinitialisation de mot de passe a été effectuée pour le compte de <strong>${name || email}</strong>.
              </p>
              <a href="${link}" style="background: #ea580c; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">Changer mon mot de passe</a>
            </div>
          </div>
        </body>
        </html>
      `;

      await transporter.sendMail({
        from: SENDER_EMAIL,
        to: email,
        subject: "Réinitialisation de votre mot de passe Pulse App",
        html,
      });

      return NextResponse.json({ success: true, message: "Email envoyé" });
    }

    // 2. ACTION : IMPERSONATE (Se connecter en tant que)
    if (action === "impersonate") {
      if (!isAtLeast(callerRole, "super_admin")) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      if (!uid) return NextResponse.json({ error: "UID requis" }, { status: 400 });
      const token = await adminAuth.createCustomToken(uid);
      return NextResponse.json({ success: true, token });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error: any) {
    console.error("❌ Erreur Admin Action:", error);
    return NextResponse.json({ error: error?.message || "Erreur" }, { status: 500 });
  }
}
