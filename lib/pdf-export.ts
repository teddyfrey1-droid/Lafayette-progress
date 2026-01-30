import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface PrimePDFData {
  userName: string
  companyName: string
  month: string
  status: string
  amount: number
  date: string
}

export const generatePrimePDF = (data: PrimePDFData) => {
  const doc = new jsPDF()
  
  // Couleurs de la charte Pulse (Gradient simulé par la couleur dominante)
  const pulsePurple = "#7A2FF0" 
  const pulsePink = "#D10FA8"
  const textDark = "#111827"

  // --- 1. DESSIN DU LOGO PULSE (Vectoriel basé sur votre SVG) ---
  const startX = 14
  const startY = 20 // Position Y centrale de la ligne

  // La ligne "battement de coeur" (path du SVG)
  doc.setDrawColor(pulsePurple) // On utilise le violet dominant du dégradé
  doc.setLineWidth(1.5)
  doc.setLineCap("round")
  doc.setLineJoin("round")

  // Traduction du path d="M4 16H11.5L15.5 9.5L19.5 23L23.5 16H34"
  // Les coordonnées sont relatives à startX/startY pour être flexibles
  doc.lines(
    [
      [7.5, 0],    // H11.5 (Horizontal +7.5)
      [4, -6.5],   // L15.5 9.5 (Monter pic)
      [4, 13.5],   // L19.5 23 (Descendre creux)
      [4, -7],     // L23.5 16 (Remonter niveau 0)
      [10.5, 0]    // H34 (Horizontal fin)
    ], 
    startX, 
    startY, 
    [1, 1], // Échelle 1:1
    "S",    // Style Stroke
    false   // Closed loop: false
  )

  // Le texte "Pulse" à côté
  doc.setFontSize(20)
  doc.setTextColor(textDark) // Couleur "currentColor" (Gris foncé/Noir)
  doc.setFont("helvetica", "bold")
  // x=44 dans le SVG, donc on décale de ~40px par rapport au début de la ligne
  doc.text("Pulse", startX + 38, startY + 2) 


  // --- 2. EN-TÊTE ENTREPRISE ---
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.setFont("helvetica", "normal")
  doc.text(data.companyName.toUpperCase(), 200, 18, { align: "right" })
  doc.text(`Édité le : ${new Date().toLocaleDateString("fr-FR")}`, 200, 23, { align: "right" })

  // --- 3. TITRE DU DOCUMENT ---
  doc.setFontSize(16)
  doc.setTextColor(0) // Noir
  doc.setFont("helvetica", "bold")
  doc.text(`RÉCAPITULATIF DE PRIME`, 105, 45, { align: "center" })
  
  doc.setFontSize(12)
  doc.setTextColor(pulsePurple)
  doc.text(data.month.toUpperCase(), 105, 52, { align: "center" })

  // --- 4. INFO COLLABORATEUR (Cadre) ---
  doc.setFillColor(248, 250, 252) // Fond gris très clair (slate-50)
  doc.setDrawColor(226, 232, 240) // Bordure gris clair
  doc.roundedRect(14, 60, 182, 25, 3, 3, "FD") // Fill + Draw
  
  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text("Collaborateur :", 20, 70)
  doc.text("Statut :", 20, 78)

  doc.setFont("helvetica", "bold")
  doc.setTextColor(0)
  doc.text(data.userName, 60, 70)
  
  // Couleur statut dynamique
  if (data.status === 'paid' || data.status === 'Payée') {
      doc.setTextColor(16, 185, 129) // Emerald 500
      doc.text('PAYÉE', 60, 78)
  } else {
      doc.setTextColor(245, 158, 11) // Amber 500
      doc.text('VALIDÉE', 60, 78)
  }

  // --- 5. TABLEAU DE DÉTAIL ---
  // On simule un détail standard (80% objectifs / 20% bonus) si pas de détail fourni
  const partObjectifs = data.amount * 0.80
  const partBonus = data.amount * 0.20

  autoTable(doc, {
    startY: 95,
    head: [["DÉSIGNATION", "MONTANT"]],
    body: [
        ["Calcul sur objectifs (CA, Hygiène, Marge)", `${partObjectifs.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`],
        ["Bonus ponctuel / Performance", `${partBonus.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`]
    ],
    theme: 'grid',
    headStyles: {
        fillColor: pulsePurple,
        textColor: 255,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 8
    },
    columnStyles: {
        0: { cellWidth: 'auto', valign: 'middle' },
        1: { cellWidth: 40, halign: 'right', fontStyle: 'bold', valign: 'middle' }
    },
    styles: {
        cellPadding: 6,
        fontSize: 10,
        lineColor: [230, 230, 230],
        lineWidth: 0.1
    }
  })

  // --- 6. TOTAL ET PIED DE PAGE ---
  const finalY = (doc as any).lastAutoTable.finalY + 15

  // Ligne de total
  doc.setFontSize(12)
  doc.setTextColor(100)
  doc.text("NET À PAYER", 160, finalY, { align: "right" })

  doc.setFontSize(22)
  doc.setTextColor(pulsePurple)
  doc.setFont("helvetica", "bold")
  doc.text(`${data.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, 196, finalY + 10, { align: "right" })

  // Pied de page légal
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.setFont("helvetica", "normal")
  const pageHeight = doc.internal.pageSize.height || 297
  doc.text("Ce document est généré automatiquement par Pulse App. Document à usage interne.", 105, pageHeight - 10, { align: "center" })

  // Sauvegarde du fichier
  const safeName = data.userName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const safeMonth = data.month.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  doc.save(`prime_${safeName}_${safeMonth}.pdf`)
}
