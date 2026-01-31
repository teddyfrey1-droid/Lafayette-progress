/**
 * Export CSV (Excel FR) avec en-tête "Pulse".
 * - Séparateur : point-virgule (;)
 * - Ajout BOM UTF-8 pour les accents
 * - Options d'en-tête (établissement / utilisateur / logo texte)
 *
 * ⚠️ CSV ne supporte pas l'inclusion d'images : le "logo" est donc représenté
 * par un texte (par défaut "PULSE") dans l'en-tête.
 */

export type PulseCSVOptions = {
  companyName?: string
  exportedBy?: string
  logoText?: string
  title?: string
}

export function exportToPulseCSV(
  filename: string,
  data: Array<Record<string, any>>,
  headers: string[],
  options: PulseCSVOptions = {},
) {
  const {
    companyName = "Non spécifié",
    exportedBy = "Utilisateur",
    logoText = "PULSE",
    title = "Export",
  } = options

  const dateExport = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  // En-tête branding (texte)
  const brandingRows: string[][] = [
    [`${logoText} — ${title}`],
    [""],
    [`Établissement : ${companyName}`],
    [`Exporté par : ${exportedBy}`],
    [`Date d'export : ${dateExport}`],
    [""],
  ]

  const escapeCell = (value: any) => {
    const str = String(value ?? "").replace(/;/g, ",")
    return `"${str.replace(/"/g, '""')}"`
  }

  const csvContent = [
    ...brandingRows.map((row) => row.join(";")),
    headers.join(";"),
    ...data.map((row) => headers.map((h) => escapeCell((row as any)[h])).join(";")),
  ].join("\n")

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  const safeFilename = filename.replace(/[^a-z0-9]/gi, "_").toLowerCase()

  link.setAttribute("href", url)
  link.setAttribute("download", `PULSE_${safeFilename}_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
