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
  // Optional receipt control fields
  receivedQuantity?: number;
  receivedOk?: boolean;
  receivedNote?: string;
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
  // When true, render a "commande non conforme" receipt report.
  nonConformity?: boolean;
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

export function generateNonConformityPdfBuffer(data: OrderPdfData): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 40;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(180, 0, 0);
  doc.text("COMMANDE NON CONFORME", marginX, y);
  doc.setTextColor(0, 0, 0);

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

  const rightX = pageWidth - marginX;
  let ry = 40;
  doc.setFontSize(10);
  for (const line of rightInfo) {
    doc.text(String(line), rightX, ry, { align: "right" });
    ry += 14;
  }

  y += 20;

  // Table
  const body = data.lines.map((l) => {
    const receivedQty = typeof l.receivedQuantity === "number" ? l.receivedQuantity : undefined;
    const status = typeof l.receivedOk === "boolean" ? (l.receivedOk ? "OK" : "PROBLÈME") : "";
    return [
      l.reference || "",
      l.productName,
      `${l.quantity} ${l.unit}`,
      receivedQty !== undefined ? `${receivedQty} ${l.unit}` : "",
      status,
      l.receivedNote ? String(l.receivedNote) : "",
    ];
  });

  autoTable(doc, {
    startY: y + 10,
    head: [["Référence", "Produit", "Qté cmd", "Qté reçue", "Statut", "Note"]],
    body,
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 6,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: [20, 20, 20],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 190 },
      2: { halign: "center", cellWidth: 70 },
      3: { halign: "center", cellWidth: 70 },
      4: { halign: "center", cellWidth: 70 },
      5: { cellWidth: 120 },
    },
    didParseCell: (hookData: any) => {
      if (hookData.section !== "body") return;
      const rowIndex = hookData.row.index;
      const line = data.lines[rowIndex];
      if (!line) return;
      if (line.receivedOk === false) {
        // Red text for problems
        hookData.cell.styles.textColor = [180, 0, 0];
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 200;

  // Summary
  const problemCount = data.lines.filter((l) => l.receivedOk === false).length;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(180, 0, 0);
  doc.text(`Anomalies signalées: ${problemCount}`, marginX, finalY + 28);
  doc.setTextColor(0, 0, 0);

  if (data.notes && data.notes.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const noteY = finalY + 54;
    doc.text("Notes commande:", marginX, noteY);
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(data.notes.trim(), pageWidth - marginX * 2);
    doc.text(wrapped, marginX, noteY + 14);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Document généré via Pulse App", marginX, doc.internal.pageSize.getHeight() - 24);

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(new Uint8Array(arrayBuffer));
}
