import { NextResponse } from "next/server"
import { adminAuth, adminDb } from "@/lib/firebase/admin"

// Firebase Admin requiert l'environnement Node.js (pas Edge)
export const runtime = "nodejs"

// --- Sécurité (optionnelle) ---
function enforceAuthIfEnabled(req: Request) {
  const requireAuth = process.env.INVITE_USER_REQUIRE_AUTH === "true"
  if (!requireAuth) return null

  const auth = req.headers.get("authorization")
  if (!auth || !auth.startsWith("Bearer ") || auth.length <= "Bearer ".length) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const expected = process.env.INVITE_USER_BEARER_TOKEN
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}

// --- Helpers (roles / entreprise) ---
const ALLOWED_ROLES = new Set([
  "super_admin",
  "admin",
  "gerant",
  "directeur",
  "manager",
  "assistant_manager",
  "employe",
  "employee",
])

function normalizeRole(input: unknown) {
  const r = typeof input === "string" ? input.toLowerCase().trim() : ""
  if (!r) return "employe"
  // Aliases / compat
  if (r === "employee" || r === "staff") return "employe"
  if (ALLOWED_ROLES.has(r)) return r
  return "employe"
}

async function resolveCompanyId(params: { companyId?: string; companyName?: string }) {
  const rawId = (params.companyId || "").trim()
  if (rawId) return rawId

  const name = (params.companyName || "").trim()
  if (!name) return ""

  try {
    const snap = await adminDb.collection("companies").where("name", "==", name).limit(1).get()
    if (!snap.empty) return snap.docs[0].id
  } catch {
    // On reste silencieux : on ne bloque pas l'invitation sur une recherche d'entreprise
  }

  return ""
}

// --- Email via Brevo HTTP API ---
const SENDER_NAME = "Pulse App"
const SENDER_EMAIL = "no-reply@pulseapp.ovh"
const LOGO_URL = "https://www.pulseapp.ovh/icon-dark-32x32.png"

function getBaseHtml(title: string, content: string, callToAction?: { link: string; text: string }) {
  const currentYear = new Date().getFullYear()
  const btnHtml = callToAction
    ? `<a href="${callToAction.link}" style="display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; margin-top: 20px;">${callToAction.text}</a>`
    : ""

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
  `
}

async function sendBrevoEmail(params: { toEmail: string; toName?: string; subject: string; htmlContent: string }) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error("BREVO_API_KEY manquant")

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

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
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => "")
      throw new Error(`Brevo API error (${res.status}): ${errorText || res.statusText}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function sendBrevoWelcomeEmail(email: string, firstName: string, companyName: string, link: string) {
  const content = `
    Vous avez été invité à rejoindre l'espace <strong>${companyName || "votre espace"}</strong>.<br>
    Votre compte est prêt à être activé.
  `
  const html = getBaseHtml(`Bienvenue ${firstName}`, content, {
    link,
    text: "Définir mon mot de passe",
  })

  await sendBrevoEmail({
    toEmail: email,
    toName: firstName,
    subject: `Bienvenue sur Pulse App, ${firstName} !`,
    htmlContent: html,
  })
}

// --- METHODE POST (INVITATION) ---
export async function POST(req: Request) {
  console.log("🚀 [API] Début invitation Pulse App")

  const authResp = enforceAuthIfEnabled(req)
  if (authResp) return authResp

  try {
    const body = await req.json()
    const { email, firstName, lastName, role, contractHours, company, companyId } = body || {}

    if (!email || !firstName || !lastName) {
      return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 })
    }

    const displayName = `${firstName} ${lastName}`.trim()
    const companyName = (company || "Heiko").trim()
    const safeRole = normalizeRole(role)

    // 1) Empêcher la création si l'utilisateur existe déjà
    try {
      await adminAuth.getUserByEmail(email)
      console.warn(`⚠️ [API] L'utilisateur ${email} existe déjà.`)
      return NextResponse.json({ error: "Cette adresse email est déjà utilisée." }, { status: 409 })
    } catch (e: any) {
      if (e?.code !== "auth/user-not-found") throw e
    }

    // 2) Auth : Création du compte
    const userRecord = await adminAuth.createUser({ email, displayName, emailVerified: true })

    // 3) Entreprise : résolution de l'ID (important pour éviter les comptes "orphelins")
    const resolvedCompanyId = await resolveCompanyId({ companyId, companyName })

    // 4) Firestore : Sauvegarde (companyId + companyName + compat company)
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      firstName,
      lastName,
      role: safeRole,
      contractHours: Number(contractHours) || 0,
      company: companyName,
      companyName,
      companyId: resolvedCompanyId || "",
      disabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // 5) Log système : création du compte / invitation
    try {
      await adminDb.collection("system_logs").add({
        userId: userRecord.uid,
        userName: displayName || email,
        userRole: safeRole,
        companyId: resolvedCompanyId || "",
        companyName,
        action: "CREATE_USER",
        details: "Compte créé (invitation envoyée)",
        timestamp: new Date().toISOString(),
        device: "server:invite-user",
      })
    } catch (e) {
      console.error("⚠️ [API] Impossible d'écrire le log CREATE_USER:", e)
    }

    // 6) Email : Génération du lien avec redirection vers /connexion
    const actionCodeSettings = {
      url: "https://pulseapp.ovh/connexion",
      handleCodeInApp: false,
    }

    const actionLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings)

    let emailSent = false
    try {
      await sendBrevoWelcomeEmail(email, firstName, companyName, actionLink)
      emailSent = true
    } catch (err) {
      console.error("⚠️ [API] Email d'invitation non envoyé (Brevo):", err)
      // On ne bloque pas la réponse si l'email échoue, l'utilisateur est créé
    }

    return NextResponse.json({ success: true, uid: userRecord.uid, emailSent })
  } catch (error: any) {
    console.error("❌ [API] Erreur Invite:", error)
    return NextResponse.json({ error: error?.message || "Erreur serveur" }, { status: 500 })
  }
}

// --- METHODE PATCH (MODIFICATION) ---
export async function PATCH(req: Request) {
  try {
    const authResp = enforceAuthIfEnabled(req)
    if (authResp) return authResp

    const body = await req.json()
    const { uid, email, firstName, lastName, role, contractHours, company, companyId } = body || {}
    if (!uid) return NextResponse.json({ error: "UID requis" }, { status: 400 })

    // Mise à jour Auth
    const authUpdates: any = {}
    if (email) authUpdates.email = email
    if (firstName || lastName) {
      const newDisplayName = `${firstName || ""} ${lastName || ""}`.trim()
      if (newDisplayName) authUpdates.displayName = newDisplayName
    }
    if (Object.keys(authUpdates).length > 0) await adminAuth.updateUser(uid, authUpdates)

    // Entreprise : si on met à jour l'entreprise, on recalcule éventuellement l'ID
    const companyName = company ? String(company).trim() : undefined
    const resolvedCompanyId =
      companyName || companyId !== undefined ? await resolveCompanyId({ companyId, companyName }) : undefined

    // Mise à jour Firestore
    const updateData: any = { updatedAt: new Date() }
    if (email) updateData.email = email
    if (firstName) updateData.firstName = firstName
    if (lastName) updateData.lastName = lastName
    if (firstName || lastName) updateData.displayName = `${firstName || ""} ${lastName || ""}`.trim()
    if (role) updateData.role = normalizeRole(role)
    if (contractHours !== undefined) updateData.contractHours = Number(contractHours)
    if (companyName) {
      updateData.company = companyName
      updateData.companyName = companyName
    }
    if (resolvedCompanyId !== undefined) updateData.companyId = resolvedCompanyId

    await adminDb.collection("users").doc(uid).update(updateData)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erreur serveur" }, { status: 500 })
  }
}

// --- METHODE DELETE (SUPPRESSION) ---
export async function DELETE(req: Request) {
  try {
    const authResp = enforceAuthIfEnabled(req)
    if (authResp) return authResp

    const { searchParams } = new URL(req.url)
    const uid = searchParams.get("uid")
    if (!uid) return NextResponse.json({ error: "UID requis" }, { status: 400 })

    await adminAuth.deleteUser(uid)
    await adminDb.collection("users").doc(uid).delete()

    // Optionnel : log suppression (on n'empêche pas)
    try {
      await adminDb.collection("system_logs").add({
        userId: uid,
        userName: "",
        userRole: "",
        companyId: "",
        companyName: "",
        action: "DELETE_USER",
        details: "Compte supprimé",
        timestamp: new Date().toISOString(),
        device: "server:invite-user",
      })
    } catch {}

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erreur serveur" }, { status: 500 })
  }
}
