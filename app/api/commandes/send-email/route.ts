import { NextRequest, NextResponse } from "next/server"

/**
 * API Route pour envoyer des commandes par email via Brevo
 * POST /api/commandes/send-email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      toEmail, 
      toName, 
      subject, 
      htmlContent,
      orderId,
      supplierId 
    } = body

    // Validation
    if (!toEmail || !subject || !htmlContent) {
      return NextResponse.json(
        { error: "Champs requis manquants: toEmail, subject, htmlContent" },
        { status: 400 }
      )
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY
    const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@pulse-app.fr"
    const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Pulse App"

    if (!BREVO_API_KEY) {
      return NextResponse.json(
        { error: "Clé API Brevo non configurée" },
        { status: 500 }
      )
    }

    // Payload pour Brevo
    const payload = {
      sender: {
        name: EMAIL_FROM_NAME,
        email: EMAIL_FROM
      },
      to: [
        {
          name: toName || toEmail,
          email: toEmail
        }
      ],
      subject: subject,
      htmlContent: htmlContent,
      tags: ["commande", `order_${orderId}`, `supplier_${supplierId}`]
    }

    // Appel API Brevo
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("Erreur Brevo:", errorData)
      return NextResponse.json(
        { error: "Erreur lors de l'envoi de l'email", details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      messageId: data.messageId,
      message: "Email envoyé avec succès"
    })

  } catch (error: any) {
    console.error("Erreur API send-email:", error)
    return NextResponse.json(
      { error: "Erreur serveur", details: error.message },
      { status: 500 }
    )
  }
}
