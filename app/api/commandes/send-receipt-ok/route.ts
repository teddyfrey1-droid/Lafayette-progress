import { NextResponse } from "next/server"
import { generateReceiptOkPdfBuffer } from "@/lib/order-pdf"

export const runtime = "nodejs"

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
    console.error("Receipt email auth failed", e)
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
    return raw
      .split(/[;,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((email) => ({ email }))
  }
  return []
}

async function sendBrevoEmail(params: {
  senderName: string
  toEmail: string
  toName?: string
  cc?: Array<{ email: string; name?: string }>
  bcc?: Array<{ email: string; name?: string }>
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
        sender: { name: params.senderName, email: DEFAULT_SENDER_EMAIL },
        to: [{ email: params.toEmail, name: params.toName || params.toEmail }],
        cc: params.cc && params.cc.length ? params.cc : undefined,
        bcc: params.bcc && params.bcc.length ? params.bcc : undefined,
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

function baseHtml(content: string) {
  const y = new Date().getFullYear()
  return `<!doctype html><html><body style="font-family:system-ui;background:#f4f4f5;padding:32px 0;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
    <div style="padding:18px 20px;background:#0f172a;color:#fff;font-weight:700;">Confirmation de réception</div>
    <div style="padding:20px;color:#0f172a;font-size:14px;line-height:1.6;">${content}</div>
    <div style="padding:14px 20px;background:#fafafa;border-top:1px solid #f4f4f5;color:#71717a;font-size:12px;text-align:center;">© ${y} Pulse App</div>
  </div>
  </body></html>`
}

export async function POST(req: Request) {
  const authResp = await enforceAuthIfEnabled(req)
  if (authResp) return authResp

  try {
    const body = await req.json()

    const toEmail = String(body?.toEmail || "").trim()
    const toName = body?.toName ? String(body.toName) : undefined
    const subject = String(body?.subject || "").trim()
    if (!toEmail || !subject) {
      return NextResponse.json({ success: false, error: "Paramètres manquants" }, { status: 400 })
    }

    const cc = normalizeEmails(body?.ccEmails)
    const bcc = normalizeEmails(body?.bccEmails)

    const order = body?.order as any
    if (!order || !Array.isArray(order?.products)) {
      return NextResponse.json({ success: false, error: "Commande manquante" }, { status: 400 })
    }

    let companyName = String(body?.companyName || "Entreprise").trim() || "Entreprise"
    let companyLegalName: string | undefined
    let companySiret: string | undefined
    let companyCustomerNumber: string | undefined

    // Fetch company legal info
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
      receivedQuantity: typeof p?.receivedQuantity === "number" ? Number(p.receivedQuantity) : undefined,
    }))

    const totalAmount = Number(order?.totalAmount || lines.reduce((s: number, l: any) => s + (Number(l.total) || 0), 0))

    const pdfBuffer = generateReceiptOkPdfBuffer({
      companyName,
      companyLegalName,
      companySiret,
      companyCustomerNumber,
      supplierName,
      supplierEmail: toEmail,
      orderNumber: orderNumber.toUpperCase(),
      createdAtISO,
      deliveryDateISO,
      lines,
      totalAmount,
    })

    const filename = `Bon_de_reception_${orderNumber.toUpperCase().replace(/[^A-Z0-9_-]/g, "_")}.pdf`
    const attachment = [{ name: filename, content: pdfBuffer.toString("base64") }]

    const htmlContent = baseHtml(
      `Bonjour,<br><br>La réception de la commande <strong>${orderNumber.toUpperCase()}</strong> a été validée par <strong>${companyName}</strong>.<br><br>Vous trouverez le bon de réception en pièce jointe.<br><br>Merci.`,
    )

    await sendBrevoEmail({
      senderName: companyName,
      toEmail,
      toName,
      cc,
      bcc,
      subject,
      htmlContent,
      attachment,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Erreur envoi réception:", error)
    return NextResponse.json({ success: false, error: error?.message || "Erreur serveur" }, { status: 500 })
  }
}
