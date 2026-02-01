import { NextResponse } from "next/server"
import { generateNonConformityPdfBuffer } from "@/lib/order-pdf"

// Firebase Admin requiert l'environnement Node.js (pas Edge)
export const runtime = "nodejs"

// Reprend la même sécurité optionnelle que /send-email
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

  try {
    const { adminAuth } = await import("@/lib/firebase/admin")
    const token = auth.slice("Bearer ".length)
    await adminAuth.verifyIdToken(token)
    return null
  } catch (e) {
    console.error("ORDER nonconformity auth failed", e)
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
}

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
        <div style="background: #991b1b; padding: 26px 0; text-align: center; color: #ffffff;">
          <div style="font-weight: 700; letter-spacing: .3px;">${title}</div>
        </div>
        <div style="padding: 26px 24px; color: #18181b;">
          <div style="font-size: 14px; line-height: 1.6; color: #52525b;">
            ${contentHtml}
          </div>
        </div>
        <div style="background: #fafafa; padding: 16px; text-align: center; font-size: 12px; color: #a1a1aa; border-top: 1px solid #f4f4f5;">
          © ${currentYear} Pulse’ App.
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

export async function POST(req: Request) {
  const authResp = await enforceAuthIfEnabled(req)
  if (authResp) return authResp

  try {
    const body = await req.json()

    const toEmail = String(body?.toEmail || "").trim()
    const toName = body?.toName ? String(body.toName) : undefined
    const subject = String(body?.subject || "").trim()
    const companyName = String(body?.companyName || "Pulse App").trim() || "Pulse App"
    const cc = normalizeEmails(body?.ccEmails)

    const order = body?.order as any | undefined
    if (!toEmail || !subject || !order || !Array.isArray(order?.products)) {
      return NextResponse.json({ success: false, error: "Paramètres manquants" }, { status: 400 })
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
      receivedQuantity: typeof p?.receivedQuantity === "number" ? Number(p.receivedQuantity) : undefined,
      receivedOk: typeof p?.receivedOk === "boolean" ? Boolean(p.receivedOk) : undefined,
      receivedNote: p?.receivedNote ? String(p.receivedNote) : undefined,
    }))

    const totalAmount = Number(order?.totalAmount || 0)

    const pdfBuffer = generateNonConformityPdfBuffer({
      companyName,
      supplierName,
      supplierEmail: toEmail,
      orderNumber: orderNumber.toUpperCase(),
      createdAtISO,
      deliveryDateISO,
      notes: order?.notes ? String(order.notes) : undefined,
      lines,
      totalAmount,
    })

    const filename = `Commande_non_conforme_${orderNumber.toUpperCase().replace(/[^A-Z0-9_-]/g, "_")}.pdf`
    const attachment = [{ name: filename, content: pdfBuffer.toString("base64") }]

    const problemCount = lines.filter((l: any) => l.receivedOk === false).length
    const htmlContent = getBaseHtml(
      "Commande non conforme",
      `Bonjour,<br><br>
      Nous constatons des <strong>non-conformités</strong> sur la commande <strong>${orderNumber.toUpperCase()}</strong>.<br>
      Merci de trouver en pièce jointe le détail (lignes en <span style="color:#991b1b;"><strong>rouge</strong></span>).<br><br>
      <strong>Anomalies signalées :</strong> ${problemCount}<br>
      <strong>Entreprise :</strong> ${companyName}<br><br>
      Merci de nous indiquer la marche à suivre (avoir / remplacement / reliquat).`,
    )

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
    console.error("Erreur envoi non-conformité:", error)
    return NextResponse.json({ success: false, error: error?.message || "Erreur serveur" }, { status: 500 })
  }
}
