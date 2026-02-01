import { NextResponse } from "next/server"
import { generateOrderPdfBuffer } from "@/lib/order-pdf"

// Firebase Admin requiert l'environnement Node.js (pas Edge)
export const runtime = "nodejs"

// --- Sécurité (optionnelle) ---
// Si ORDER_EMAIL_REQUIRE_AUTH=true :
// - Si ORDER_EMAIL_BEARER_TOKEN est défini, il faut le token exact
// - Sinon, on attend un Firebase ID token (Bearer ...) et on le vérifie
async function enforceAuthIfEnabled(req: Request) {
  const requireAuth = process.env.ORDER_EMAIL_REQUIRE_AUTH === "true"
  if (!requireAuth) return null

  const auth = req.headers.get("authorization")
  if (!auth || !auth.startsWith("Bearer ") || auth.length <= "Bearer ".length) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const expected = process.env.ORDER_EMAIL_BEARER_TOKEN
  if (expected) {
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return null
  }

  // Fallback: verify Firebase ID token
  try {
    const { adminAuth } = await import("@/lib/firebase/admin")
    const token = auth.slice("Bearer ".length)
    await adminAuth.verifyIdToken(token)
    return null
  } catch (e) {
    console.error("ORDER email auth failed", e)
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
}

// --- Email via Brevo HTTP API ---
const DEFAULT_SENDER_EMAIL = "no-reply@pulseapp.ovh"

function normalizeEmails(raw: unknown): Array<{ email: string; name?: string }> {
  if (Array.isArray(raw)) {
    const out: Array<{ email: string; name?: string }> = []
    for (const it of raw) {
      if (typeof it === "string") {
        const email = it.trim()
        if (email) out.push({ email })
      } else if (it && typeof it === "object") {
        const email = String((it as any).email || "").trim()
        const name = String((it as any).name || "").trim()
        if (email) out.push(name ? { email, name } : { email })
      }
    }
    return out
  }

  if (typeof raw === "string") {
    const parts = raw
      .split(/[;,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    return parts.map((email) => ({ email }))
  }

  return []
}

function getBaseHtml(title: string, contentHtml: string) {
  const currentYear = new Date().getFullYear()
  return `
    <!DOCTYPE html>
    <html style="font-family: sans-serif;">
    <body style="background: #f4f4f5; padding: 40px 0; margin: 0;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e4e4e7;">
        <div style="background: #000000; padding: 26px 0; text-align: center; color: #ffffff;">
          <div style="font-weight: 700; letter-spacing: .3px;">${title}</div>
        </div>
        <div style="padding: 26px 24px; color: #18181b;">
          <div style="font-size: 14px; line-height: 1.6; color: #52525b;">
            ${contentHtml}
          </div>
        </div>
        <div style="background: #fafafa; padding: 16px; text-align: center; font-size: 12px; color: #a1a1aa; border-top: 1px solid #f4f4f5;">
          © ${currentYear} Pulse App.
        </div>
      </div>
    </body>
    </html>
  `
}

async function sendBrevoEmail(params: {
  senderName: string
  senderEmail?: string
  toEmail: string
  toName?: string
  cc?: Array<{ email: string; name?: string }>
  subject: string
  htmlContent: string
  attachment?: Array<{ name: string; content: string }>
}) {
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
        sender: { name: params.senderName, email: params.senderEmail || DEFAULT_SENDER_EMAIL },
        to: [{ email: params.toEmail, name: params.toName || params.toEmail }],
        cc: params.cc && params.cc.length ? params.cc : undefined,
        subject: params.subject,
        htmlContent: params.htmlContent,
        attachment: params.attachment && params.attachment.length ? params.attachment : undefined,
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

// --- POST ---
export async function POST(req: Request) {
  const authResp = await enforceAuthIfEnabled(req)
  if (authResp) return authResp

  try {
    const body = await req.json()

    // Compat legacy
    const toEmail = String(body?.toEmail || "").trim()
    const toName = body?.toName ? String(body.toName) : undefined
    const subject = String(body?.subject || "").trim()

    if (!toEmail || !subject) {
      return NextResponse.json({ success: false, error: "Paramètres manquants" }, { status: 400 })
    }

    let companyName = String(body?.companyName || "Pulse App").trim() || "Pulse App"
    let companyLegalName: string | undefined
    let companySiret: string | undefined
    let companyCustomerNumber: string | undefined
    const cc = normalizeEmails(body?.ccEmails)

    // If an order is provided, we generate and attach the PDF
    const order = body?.order as any | undefined

    let htmlContent = String(body?.htmlContent || "").trim()
    let attachment: Array<{ name: string; content: string }> | undefined

    if (order && Array.isArray(order?.products)) {
      // Fetch company legal info (for professional PDFs)
      try {
        const companyId = String(order?.companyId || "").trim()
        if (companyId) {
          const { adminDb } = await import("@/lib/firebase/admin")
          const snap = await adminDb.collection("companies").doc(companyId).get()
          if (snap.exists) {
            const d: any = snap.data() || {}
            companyName = String(d?.name || companyName).trim() || companyName
            companyLegalName = d?.legalName ? String(d.legalName).trim() : undefined
            companySiret = d?.siret ? String(d.siret).trim() : undefined
            companyCustomerNumber = d?.customerNumber ? String(d.customerNumber).trim() : undefined
          }
        }
      } catch (e) {
        console.warn("Company legal info fetch failed", e)
      }
      const orderNumber = String(order?.orderNumber || order?.id || "").trim() || "COMMANDE"
      const deliveryDateISO = String(order?.deliveryDate || "").trim()
      const createdAtISO = order?.createdAt ? String(order.createdAt) : undefined
      const supplierName = String(order?.supplierName || toName || "Fournisseur")

      const lines = order.products.map((p: any) => ({
        productName: String(p?.productName || "").trim(),
        reference: p?.reference ? String(p.reference) : undefined,
        quantity: Number(p?.quantity || 0),
        unit: String(p?.unit || "u"),
        unitPrice: Number(p?.unitPrice || 0),
        total: Number(p?.total || 0),
      }))

      const totalAmount = Number(order?.totalAmount || lines.reduce((s: number, l: any) => s + (Number(l.total) || 0), 0))

      const pdfBuffer = generateOrderPdfBuffer({
        companyName,
        companyLegalName,
        companySiret,
        companyCustomerNumber,
        supplierName,
        supplierEmail: toEmail,
        orderNumber: orderNumber.toUpperCase(),
        createdAtISO,
        deliveryDateISO,
        notes: order?.notes ? String(order.notes) : undefined,
        lines,
        totalAmount,
      })

      const filename = `Bon_de_commande_${orderNumber.toUpperCase().replace(/[^A-Z0-9_-]/g, "_")}.pdf`
      attachment = [{ name: filename, content: pdfBuffer.toString("base64") }]

      // Email body (simple, PDF is the source of truth)
      if (!htmlContent) {
        htmlContent = getBaseHtml(
          "Nouvelle commande",
          `Bonjour,<br><br>Veuillez trouver en pièce jointe le <strong>bon de commande</strong> émis par <strong>${companyName}</strong>.<br><br>Livraison prévue le <strong>${new Date(deliveryDateISO).toLocaleDateString("fr-FR")}</strong>.<br><br>Merci.`,
        )
      }
    } else {
      // If no HTML provided, still send a minimal email
      if (!htmlContent) {
        htmlContent = getBaseHtml(
          "Message",
          `Bonjour,<br><br>${companyName} vous a envoyé un message depuis Pulse App.<br><br>Merci.`,
        )
      }
    }

    await sendBrevoEmail({
      senderName: companyName,
      toEmail,
      toName,
      cc,
      subject,
      htmlContent,
      attachment,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Erreur envoi email:", error)
    return NextResponse.json({ success: false, error: error?.message || "Erreur serveur" }, { status: 500 })
  }
}
