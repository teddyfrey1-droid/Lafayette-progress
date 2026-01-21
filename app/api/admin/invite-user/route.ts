import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import nodemailer from "nodemailer";
import {
  ROLE_HIERARCHY,
  clampContractHours,
  isAtLeast,
  normalizeRole,
  roleRank,
} from "@/lib/identity";

// --- CONFIGURATION ---
const SENDER_EMAIL = '"Pulse App" <no-reply@pulseapp.ovh>';
const LOGO_URL = "https://www.pulseapp.ovh/icon-dark-32x32.png";

type Session = {
  uid: string;
  role: string;
  tenantKey: string;
  companyName: string;
};

function getTenantFromUserData(data: any): string {
  return String(data?.companyId || data?.company || "default");
}

function getCompanyNameFromUserData(data: any, fallbackTenant: string): string {
  return String(data?.companyName || data?.company || fallbackTenant || "default");
}

function isKnownRole(r: string): boolean {
  const normalized = normalizeRole(r);
  return ROLE_HIERARCHY.includes(normalized as any);
}

async function requireCaller(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return {
      error: NextResponse.json({ error: "Authentification requise" }, { status: 401 }),
    } as const;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(m[1]);
    const snap = await adminDb.collection("users").doc(decoded.uid).get();
    const data: any = snap.exists ? snap.data() : {};

    const role = normalizeRole(data?.role);
    const tenantKey = getTenantFromUserData(data);
    const companyName = getCompanyNameFromUserData(data, tenantKey);

    return { uid: decoded.uid, role, tenantKey, companyName } as const;
  } catch {
    return {
      error: NextResponse.json({ error: "Token invalide" }, { status: 401 }),
    } as const;
  }
}

function canAssignRoleFrom(callerRole: string, newRole: string): boolean {
  // Ne pas permettre d'assigner un rôle plus élevé que celui du caller.
  return roleRank(newRole) >= roleRank(callerRole);
}

function enforceTenant(session: Session, targetTenant: string) {
  if (normalizeRole(session.role) === "super_admin") return null;
  if (String(targetTenant) !== String(session.tenantKey)) {
    return NextResponse.json({ error: "Accès refusé (tenant)" }, { status: 403 });
  }
  return null;
}

async function getTargetUserTenant(uid: string): Promise<{ tenantKey: string; companyName: string } | null> {
  try {
    const snap = await adminDb.collection("users").doc(uid).get();
    if (!snap.exists) return null;
    const data: any = snap.data();
    const tenantKey = getTenantFromUserData(data);
    const companyName = getCompanyNameFromUserData(data, tenantKey);
    return { tenantKey, companyName };
  } catch {
    return null;
  }
}

// --- POST: INVITER UN UTILISATEUR ---
export async function POST(req: Request) {
  const session = await requireCaller(req);
  if ("error" in session) return session.error;
  if (!isAtLeast(session.role, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const body = (await req.json().catch(() => ({} as any))) as any;

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";

    const requestedRole = normalizeRole(body.role);
    if (!isKnownRole(requestedRole)) {
      return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
    }
    if (!canAssignRoleFrom(session.role, requestedRole)) {
      return NextResponse.json({ error: "Rôle non autorisé" }, { status: 403 });
    }

    const hours = clampContractHours(body.contractHours, 35);
    const excludeFromPrimes = Boolean(body.excludeFromPrimes);

    // Tenant cible
    const requestedTenant = typeof body.companyId === "string" ? body.companyId.trim() : "";
    const targetTenant = normalizeRole(session.role) === "super_admin"
      ? (requestedTenant || session.tenantKey)
      : session.tenantKey;

    const deny = enforceTenant(session, targetTenant);
    if (deny) return deny;

    const companyNameInput =
      (typeof body.companyName === "string" && body.companyName.trim()) ||
      (typeof body.company === "string" && body.company.trim()) ||
      session.companyName ||
      targetTenant;

    if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 });

    const displayName = `${firstName} ${lastName}`.trim();

    // 1) Auth
    const userRecord = await adminAuth.createUser({
      email,
      displayName,
      emailVerified: true,
    });

    // 2) Firestore
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      firstName,
      lastName,
      role: requestedRole,
      contractHours: hours,

      companyId: targetTenant,
      companyName: companyNameInput,
      company: companyNameInput,

      excludeFromPrimes,
      disabled: false,
      lastLogin: null,
      pushEnabled: false,

      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3) Lien & Email
    const actionLink = await adminAuth.generatePasswordResetLink(email);

    const brevoUser = process.env.BREVO_USER;
    const brevoPass = process.env.BREVO_PASS;
    if (!brevoUser || !brevoPass) {
      console.error("[API] SMTP not configured: missing BREVO_USER/BREVO_PASS");
      return NextResponse.json({ error: "SMTP non configuré." }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 2525,
      secure: false,
      auth: { user: brevoUser, pass: brevoPass },
    });

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
            <h1 class="h1">Bienvenue ${firstName || ""}</h1>
            <p class="text">
              Vous avez été invité à rejoindre l'espace <strong>${companyNameInput}</strong>.
              <br>Votre compte est prêt à être activé.
            </p>
            <a href="${actionLink}" class="btn">Définir mon mot de passe</a>
          </div>
          <div class="footer">© ${new Date().getFullYear()} Pulse App. Tous droits réservés.</div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: SENDER_EMAIL,
      to: email,
      subject: `Bienvenue sur Pulse App${firstName ? ", " + firstName : ""} !`,
      html: emailHtml,
    });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    console.error("❌ [API] Erreur Invite:", error);
    return NextResponse.json({ error: error?.message || "Erreur" }, { status: 500 });
  }
}

// --- PATCH: MODIFIER UTILISATEUR ---
export async function PATCH(req: Request) {
  const session = await requireCaller(req);
  if ("error" in session) return session.error;
  if (!isAtLeast(session.role, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const body = (await req.json().catch(() => ({} as any))) as any;
    const uid = typeof body.uid === "string" ? body.uid : "";
    if (!uid) return NextResponse.json({ error: "UID requis" }, { status: 400 });

    // Tenant check vs existing user doc
    const targetInfo = await getTargetUserTenant(uid);
    if (targetInfo) {
      const deny = enforceTenant(session, targetInfo.tenantKey);
      if (deny) return deny;
    } else {
      // If user doc missing, only super_admin can proceed.
      if (normalizeRole(session.role) !== "super_admin") {
        return NextResponse.json({ error: "Accès refusé (user not found)" }, { status: 403 });
      }
    }

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";

    const requestedRole = body.role ? normalizeRole(body.role) : undefined;
    if (requestedRole) {
      if (!isKnownRole(requestedRole)) {
        return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
      }
      if (!canAssignRoleFrom(session.role, requestedRole)) {
        return NextResponse.json({ error: "Rôle non autorisé" }, { status: 403 });
      }
    }

    const hours = body.contractHours !== undefined ? clampContractHours(body.contractHours, 35) : undefined;
    const excludeFromPrimes = body.excludeFromPrimes !== undefined ? Boolean(body.excludeFromPrimes) : undefined;
    const disabled = body.disabled !== undefined ? Boolean(body.disabled) : undefined;

    const requestedTenant = typeof body.companyId === "string" ? body.companyId.trim() : "";
    const newTenant = requestedTenant || targetInfo?.tenantKey || session.tenantKey;

    // Only super_admin can move a user between tenants.
    if (normalizeRole(session.role) !== "super_admin") {
      if (String(newTenant) !== String(session.tenantKey)) {
        return NextResponse.json({ error: "Accès refusé (tenant)" }, { status: 403 });
      }
    }

    const companyNameInput =
      (typeof body.companyName === "string" && body.companyName.trim()) ||
      (typeof body.company === "string" && body.company.trim()) ||
      targetInfo?.companyName ||
      session.companyName ||
      newTenant;

    // 1) Auth updates
    const authUpdates: any = {};
    if (email) authUpdates.email = email;

    if (firstName || lastName) {
      const newDisplayName = `${firstName || ""} ${lastName || ""}`.trim();
      if (newDisplayName) authUpdates.displayName = newDisplayName;
    }

    if (disabled !== undefined) {
      authUpdates.disabled = disabled;
    }

    if (Object.keys(authUpdates).length > 0) {
      await adminAuth.updateUser(uid, authUpdates);
    }

    // 2) Firestore update
    const updateData: any = { updatedAt: new Date() };
    if (email) updateData.email = email;
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (firstName || lastName) {
      updateData.displayName = `${firstName || ""} ${lastName || ""}`.trim();
    }
    if (requestedRole) updateData.role = requestedRole;
    if (hours !== undefined) updateData.contractHours = hours;

    // Tenant fields
    updateData.companyId = newTenant;
    updateData.companyName = companyNameInput;
    updateData.company = companyNameInput;

    if (excludeFromPrimes !== undefined) updateData.excludeFromPrimes = excludeFromPrimes;
    if (disabled !== undefined) updateData.disabled = disabled;

    await adminDb.collection("users").doc(uid).update(updateData);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ [API] Erreur Update:", error);
    return NextResponse.json({ error: error?.message || "Erreur" }, { status: 500 });
  }
}

// --- DELETE: SUPPRIMER UTILISATEUR ---
export async function DELETE(req: Request) {
  const session = await requireCaller(req);
  if ("error" in session) return session.error;
  if (!isAtLeast(session.role, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");
    if (!uid) return NextResponse.json({ error: "UID requis" }, { status: 400 });

    const targetInfo = await getTargetUserTenant(uid);
    if (targetInfo) {
      const deny = enforceTenant(session as Session, targetInfo.tenantKey);
      if (deny) return deny;
    } else {
      if (normalizeRole(session.role) !== "super_admin") {
        return NextResponse.json({ error: "Accès refusé (user not found)" }, { status: 403 });
      }
    }

    await adminAuth.deleteUser(uid);
    await adminDb.collection("users").doc(uid).delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erreur" }, { status: 500 });
  }
}
