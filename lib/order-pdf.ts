import "server-only";

import { jsPDF } from "jspdf";
// @ts-ignore - types are provided via jspdf-autotable, but TS sometimes doesn't see the module augmentation
import autoTable from "jspdf-autotable";

export type OrderPdfLine = {
  productName: string;
  reference?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
};

export type OrderPdfData = {
  companyName: string;
  supplierName: string;
  supplierEmail?: string;
  orderNumber: string;
  createdAtISO?: string;
  deliveryDateISO: string;
  notes?: string;
  lines: OrderPdfLine[];
  totalAmount: number;
};

function formatEuro(n: number) {
  const v = Number(n || 0);
  return `${v.toFixed(2).replace(".", ",")} €`;
}

function formatDateFR(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
}

export function generateOrderPdfBuffer(data: OrderPdfData): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 40;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("BON DE COMMANDE", marginX, y);

  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`N°: ${data.orderNumber}`, marginX, y);

  const rightInfo = [
    `Entreprise: ${data.companyName || ""}`,
    `Fournisseur: ${data.supplierName || ""}`,
    data.supplierEmail ? `Email: ${data.supplierEmail}` : "",
    `Livraison: ${formatDateFR(data.deliveryDateISO)}`,
    data.createdAtISO ? `Créée le: ${formatDateFR(data.createdAtISO)}` : "",
  ].filter(Boolean);

  // Right column
  const rightX = pageWidth - marginX;
  let ry = 40;
  doc.setFontSize(10);
  for (const line of rightInfo) {
    doc.text(String(line), rightX, ry, { align: "right" });
    ry += 14;
  }

  y += 20;

  // Table
  const body = data.lines.map((l) => [
    l.reference || "",
    l.productName,
    `${l.quantity} ${l.unit}`,
    formatEuro(l.unitPrice),
    formatEuro(l.total),
  ]);

  autoTable(doc, {
    startY: y + 10,
    head: [["Référence", "Produit", "Qté", "Prix unité", "Total"]],
    body,
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 6,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [20, 20, 20],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 230 },
      2: { halign: "center", cellWidth: 80 },
      3: { halign: "right", cellWidth: 80 },
      4: { halign: "right", cellWidth: 80 },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 200;

  // Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`TOTAL: ${formatEuro(data.totalAmount)}`, pageWidth - marginX, finalY + 24, { align: "right" });

  // Notes
  if (data.notes && data.notes.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const noteY = finalY + 52;
    doc.text("Notes:", marginX, noteY);
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(data.notes.trim(), pageWidth - marginX * 2);
    doc.text(wrapped, marginX, noteY + 14);
  }

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Document généré via Pulse App", marginX, doc.internal.pageSize.getHeight() - 24);

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(new Uint8Array(arrayBuffer));
}
