export function exportToPulseCSV(filename: string, data: any[], headers: string[]) {
  // 1. Branding Header
  const brandingRow = [`EXPORT GÉNÉRÉ PAR PULSE APP - ${new Date().toLocaleDateString()}`]
  const emptyRow = [""]
  
  // 2. Formatage des données
  const csvContent = [
    brandingRow.join(","),
    emptyRow.join(","),
    headers.join(","), // En-têtes colonnes
    ...data.map(row => {
      // Nettoyage des virgules et sauts de ligne dans les données pour ne pas casser le CSV
      return Object.values(row).map(value => {
         const stringValue = String(value || "")
         return `"${stringValue.replace(/"/g, '""')}"` // Escape quotes
      }).join(",")
    })
  ].join("\n")

  // 3. Création du Blob et Téléchargement
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  
  // Nommage brandé
  const safeFilename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  link.setAttribute("href", url)
  link.setAttribute("download", `PULSE_${safeFilename}_${new Date().toISOString().slice(0, 10)}.csv`)
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
