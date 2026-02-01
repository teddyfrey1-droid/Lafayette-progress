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
  companyLegalName?: string;
  companySiret?: string;
  companyCustomerNumber?: string;
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

  const companyDisplayName = (data.companyLegalName || data.companyName || "").trim() || "Entreprise";

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("BON DE COMMANDE", marginX, y);

  // Order number (top-right)
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`N° ${data.orderNumber}`, pageWidth - marginX, y, { align: "right" });

  y += 18;

  // Header box (buyer / supplier)
  const boxTop = y + 10;
  const boxHeight = 84;
  doc.setDrawColor(220);
  doc.setLineWidth(1);
  doc.roundedRect(marginX, boxTop, pageWidth - marginX * 2, boxHeight, 10, 10);

  const colGap = 16;
  const colW = (pageWidth - marginX * 2 - colGap) / 2;
  const leftX = marginX + 14;
  const rightX = marginX + 14 + colW + colGap;
  let leftY = boxTop + 18;
  let rightY = boxTop + 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("ACHETEUR", leftX, leftY);
  doc.text("FOURNISSEUR", rightX, rightY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  leftY += 14;
  rightY += 14;

  const buyerLines = [
    companyDisplayName,
    data.companySiret ? `SIRET : ${String(data.companySiret).trim()}` : null,
    data.companyCustomerNumber ? `N° client : ${String(data.companyCustomerNumber).trim()}` : null,
  ].filter(Boolean) as string[];
  const supplierLines = [
    (data.supplierName || "").trim() || "Fournisseur",
    data.supplierEmail ? `Email : ${String(data.supplierEmail).trim()}` : null,
  ].filter(Boolean) as string[];

  doc.text(buyerLines, leftX, leftY);
  doc.text(supplierLines, rightX, rightY);

  y = boxTop + boxHeight + 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const metaLeft = `Livraison prévue : ${formatDateFR(data.deliveryDateISO)}`;
  const metaRight = data.createdAtISO ? `Créée le : ${formatDateFR(data.createdAtISO)}` : "";
  doc.text(metaLeft, marginX, y);
  if (metaRight) doc.text(metaRight, pageWidth - marginX, y, { align: "right" });

  y += 14;

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

  const companyDisplayName = (data.companyLegalName || data.companyName || "").trim() || "Entreprise";

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(180, 0, 0);
  doc.text("COMMANDE NON CONFORME", marginX, y);
  doc.setTextColor(0, 0, 0);

  // Order number (top-right)
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`N° ${data.orderNumber}`, pageWidth - marginX, y, { align: "right" });

  y += 18;

  // Header box (buyer / supplier)
  const boxTop = y + 10;
  const boxHeight = 84;
  doc.setDrawColor(220);
  doc.setLineWidth(1);
  doc.roundedRect(marginX, boxTop, pageWidth - marginX * 2, boxHeight, 10, 10);

  const colGap = 16;
  const colW = (pageWidth - marginX * 2 - colGap) / 2;
  const leftX = marginX + 14;
  const rightX = marginX + 14 + colW + colGap;
  let leftY = boxTop + 18;
  let rightY = boxTop + 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("ACHETEUR", leftX, leftY);
  doc.text("FOURNISSEUR", rightX, rightY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  leftY += 14;
  rightY += 14;

  const buyerLines = [
    companyDisplayName,
    data.companySiret ? `SIRET : ${String(data.companySiret).trim()}` : null,
    data.companyCustomerNumber ? `N° client : ${String(data.companyCustomerNumber).trim()}` : null,
  ].filter(Boolean) as string[];
  const supplierLines = [
    (data.supplierName || "").trim() || "Fournisseur",
    data.supplierEmail ? `Email : ${String(data.supplierEmail).trim()}` : null,
  ].filter(Boolean) as string[];

  doc.text(buyerLines, leftX, leftY);
  doc.text(supplierLines, rightX, rightY);

  y = boxTop + boxHeight + 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const metaLeft = `Livraison prévue : ${formatDateFR(data.deliveryDateISO)}`;
  const metaRight = data.createdAtISO ? `Créée le : ${formatDateFR(data.createdAtISO)}` : "";
  doc.text(metaLeft, marginX, y);
  if (metaRight) doc.text(metaRight, pageWidth - marginX, y, { align: "right" });

  y += 14;

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
