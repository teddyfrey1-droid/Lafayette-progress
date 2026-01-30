/**
 * Export CSV amélioré pour Pulse App
 * Inclut : branding Pulse, nom établissement, nom utilisateur, date
 */

interface ExportOptions {
  companyName?: string
  exportedBy?: string
  logoText?: string
}

export function exportToPulseCSV(
  filename: string, 
  data: any[], 
  headers: string[],
  options: ExportOptions = {}
) {
  const { 
    companyName = "Non spécifié", 
    exportedBy = "Utilisateur",
    logoText = "PULSE"
  } = options

  const dateExport = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long", 
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })

  // 1. Header avec branding complet
  const brandingRows = [
    [`═══════════════════════════════════════════════════════════`],
    [`    ${logoText} - Système de Gestion des Primes`],
    [`═══════════════════════════════════════════════════════════`],
    [``],
    [`Établissement : ${companyName}`],
    [`Exporté par : ${exportedBy}`],
    [`Date d'export : ${dateExport}`],
    [``],
    [`───────────────────────────────────────────────────────────`],
    [``]
  ]
  
  // 2. Formatage des données avec Point-Virgule (;) pour Excel FR
  const csvContent = [
    ...brandingRows.map(row => row.join(";")),
    headers.join(";"), // En-têtes
    ...data.map(row => {
      return Object.values(row).map(value => {
         // Nettoyage : on remplace les ; par des , dans le texte pour ne pas casser les colonnes
         const stringValue = String(value ?? "").replace(/;/g, ",")
         return `"${stringValue.replace(/"/g, '""')}"` 
      }).join(";")
    })
  ].join("\n")

  // 3. Ajout du BOM pour que Excel reconnaisse les accents (UTF-8)
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  
  const safeFilename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  link.setAttribute("href", url)
  link.setAttribute("download", `PULSE_${safeFilename}_${new Date().toISOString().slice(0, 10)}.csv`)
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
