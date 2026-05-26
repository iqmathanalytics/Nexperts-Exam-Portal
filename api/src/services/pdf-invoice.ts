import PDFDocument from "pdfkit";
import { COMPANY } from "../lib/company.js";
import { pdfToBuffer } from "./pdf-buffer.js";

export type InvoicePdfInput = {
  invoiceId: string;
  issuedAt: Date;
  status: string;
  method: string;
  examTitle: string;
  examDescription?: string;
  amount: number;
  currency?: string;
  voucherCode?: string | null;
  discountAmount?: number;
  billTo: {
    fullName: string;
    email: string;
    phone?: string | null;
    icPassport?: string | null;
  };
};

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-MY", { year: "numeric", month: "long", day: "numeric" });
}

export async function generateInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const currency = input.currency ?? "MYR";
  const subtotal = input.amount + (input.discountAmount ?? 0);
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const brand = "#8B1538";
  const muted = "#666666";
  const pageW = doc.page.width - 100;

  // Header band
  doc.rect(0, 0, doc.page.width, 110).fill(brand);
  doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold").text(COMPANY.name, 50, 36);
  doc.fontSize(9).font("Helvetica").text("TAX INVOICE / RECEIPT", 50, 62);

  doc.fillColor("#111111");
  let y = 130;

  // Company block (left) + invoice meta (right)
  doc.font("Helvetica-Bold").fontSize(10).text("From", 50, y);
  doc.font("Helvetica").fontSize(9).fillColor(muted);
  let fromY = y + 14;
  doc.text(COMPANY.legalName, 50, fromY);
  fromY += 12;
  for (const line of COMPANY.addressLines) {
    doc.text(line, 50, fromY);
    fromY += 12;
  }
  doc.text(COMPANY.email, 50, fromY);
  fromY += 12;
  doc.text(COMPANY.phone, 50, fromY);
  if (COMPANY.taxId) {
    fromY += 12;
    doc.text(`Tax ID: ${COMPANY.taxId}`, 50, fromY);
  }

  const metaX = 320;
  doc.fillColor("#111111").font("Helvetica-Bold").fontSize(10).text("Invoice details", metaX, y);
  doc.font("Helvetica").fontSize(9).fillColor(muted);
  let metaY = y + 14;
  doc.text(`Invoice No: ${input.invoiceId}`, metaX, metaY);
  metaY += 12;
  doc.text(`Date: ${formatDate(input.issuedAt)}`, metaX, metaY);
  metaY += 12;
  doc.text(`Status: ${input.status}`, metaX, metaY);
  metaY += 12;
  doc.text(`Payment: ${input.method}`, metaX, metaY);

  y = Math.max(fromY, metaY) + 28;

  // Bill to
  doc.fillColor("#111111").font("Helvetica-Bold").fontSize(10).text("Bill to", 50, y);
  y += 14;
  doc.font("Helvetica").fontSize(10).text(input.billTo.fullName, 50, y);
  y += 14;
  doc.fontSize(9).fillColor(muted).text(input.billTo.email, 50, y);
  y += 12;
  if (input.billTo.phone) {
    doc.text(`Phone: ${input.billTo.phone}`, 50, y);
    y += 12;
  }
  if (input.billTo.icPassport) {
    doc.text(`IC / Passport: ${input.billTo.icPassport}`, 50, y);
    y += 12;
  }

  y += 16;

  // Table header
  const colDesc = 50;
  const colAmt = 480;
  doc.rect(50, y, pageW, 22).fill("#f4f4f5");
  doc.fillColor("#111111").font("Helvetica-Bold").fontSize(9);
  doc.text("Description", colDesc + 8, y + 6);
  doc.text("Amount", colAmt, y + 6, { width: 65, align: "right" });
  y += 28;

  doc.font("Helvetica").fontSize(10).fillColor("#111111");
  doc.text(input.examTitle, colDesc + 8, y, { width: 380 });
  const descH = doc.heightOfString(input.examTitle, { width: 380 });
  if (input.examDescription) {
    doc.fontSize(8).fillColor(muted).text(input.examDescription.slice(0, 180), colDesc + 8, y + descH + 2, {
      width: 380,
    });
  }
  const rowH = Math.max(36, descH + (input.examDescription ? 18 : 0));
  doc.fontSize(10).fillColor("#111111").text(formatMoney(subtotal, currency), colAmt, y, {
    width: 65,
    align: "right",
  });
  y += rowH + 8;

  doc.moveTo(50, y).lineTo(50 + pageW, y).strokeColor("#e5e5e5").stroke();
  y += 16;

  if (input.voucherCode && (input.discountAmount ?? 0) > 0) {
    doc.fontSize(9).fillColor(muted).text(`Voucher (${input.voucherCode})`, colDesc + 8, y);
    doc.text(`-${formatMoney(input.discountAmount!, currency)}`, colAmt, y, { width: 65, align: "right" });
    y += 18;
  }

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111");
  doc.text("Total paid", colDesc + 8, y);
  doc.fillColor(brand).text(formatMoney(input.amount, currency), colAmt, y, { width: 65, align: "right" });

  y += 40;
  doc.font("Helvetica").fontSize(9).fillColor(muted);
  doc.text(
    "Thank you for your purchase. This invoice confirms payment for your exam registration. " +
      "Please retain this document for your records.",
    50,
    y,
    { width: pageW, align: "left" },
  );

  if (COMPANY.website) {
    doc.text(COMPANY.website, 50, doc.page.height - 60, { width: pageW, align: "center" });
  }

  return pdfToBuffer(doc);
}
