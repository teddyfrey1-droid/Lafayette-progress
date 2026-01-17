export function exportToPulseCSV(filename: string, data: any[], headers: string[]) {
  // 1. Branding Header
  const brandingRow = [`EXPORT GÉNÉRÉ PAR PULSE APP - ${new Date().toLocaleDateString("fr-FR")}`]
  const emptyRow = [""]
  
  // 2. Formatage des données avec Point-Virgule (;) pour Excel FR
  const csvContent = [
    brandingRow.join(";"),
    emptyRow.join(";"),
    headers.join(";"), // En-têtes
    ...data.map(row => {
      return Object.values(row).map(value => {
         // Nettoyage : on remplace les ; par des , dans le texte pour ne pas casser les colonnes
         const stringValue = String(value || "").replace(/;/g, ",")
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
}
