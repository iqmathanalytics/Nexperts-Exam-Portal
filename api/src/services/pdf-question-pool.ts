import PDFDocument from "pdfkit";
import { pdfToBuffer } from "./pdf-buffer.js";

export type QuestionPoolPdfQuestion = {
  title: string;
  topic: string;
  type: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

export type QuestionPoolPdfInput = {
  poolName: string;
  poolDescription?: string;
  questions: QuestionPoolPdfQuestion[];
};

const MARGIN = 40;
const HEADER_BG = "#374151";
const OPTION_FILL = "#f8fafc";
const OPTION_BORDER = "#cbd5e1";
const CORRECT_FILL = "#ecfdf5";
const CORRECT_BORDER = "#6ee7b7";

function drawPoolTitle(doc: PDFKit.PDFDocument, y: number): number {
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(28);
  doc.text("PASSEASY", MARGIN, y, {
    width: contentWidth(doc),
    align: "center",
    characterSpacing: 1.8,
  });
  doc.fillColor("#000000");
  return doc.y + 18;
}

function optionLabel(index: number) {
  return String.fromCharCode(65 + index);
}

function formatCorrectAnswer(correctAnswer: string, options: string[]): string {
  const trimmed = correctAnswer?.trim();
  if (!trimmed) return "Not specified.";
  const idx = options.findIndex((o) => o.trim() === trimmed);
  if (idx >= 0) return `${optionLabel(idx)}. ${trimmed}`;
  return trimmed;
}

function contentWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - MARGIN * 2;
}

function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number): number {
  if (y + needed > doc.page.height - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

export async function generateQuestionPoolPdf(input: QuestionPoolPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN });
  const w = contentWidth(doc);

  let y = MARGIN;
  y = drawPoolTitle(doc, y);

  y += 8;
  doc.font("Helvetica-Bold").fontSize(17).fillColor("#111827");
  doc.text(input.poolName, MARGIN, y, { width: w, align: "center" });
  y = doc.y + 6;

  doc.font("Helvetica").fontSize(10).fillColor("#6b7280");
  doc.text(
    `${input.questions.length} question${input.questions.length === 1 ? "" : "s"}`,
    MARGIN,
    y,
    { width: w, align: "center" },
  );
  y = doc.y + 6;

  if (input.poolDescription?.trim()) {
    doc.text(input.poolDescription.trim(), MARGIN, y, { width: w, align: "center" });
    y = doc.y + 6;
  }

  doc.moveTo(MARGIN, y + 6).lineTo(MARGIN + w, y + 6).strokeColor("#e5e7eb").lineWidth(1).stroke();
  y += 22;

  for (let i = 0; i < input.questions.length; i++) {
    const q = input.questions[i];
    const topic = q.topic?.trim() || "General";
    const options = (q.options ?? []).filter((o) => o?.trim());
    const explanation = q.explanation?.trim() || "No explanation provided.";

    y = ensureSpace(doc, y, 100);

    const headerH = 22;
    doc.rect(MARGIN, y, w, headerH).fill(HEADER_BG);
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#ffffff");
    doc.text(`Question #${i + 1} (Topic: ${topic})`, MARGIN + 10, y + 6, { width: w - 20 });
    y += headerH + 12;

    doc.font("Helvetica").fontSize(11).fillColor("#111827");
    const questionH = doc.heightOfString(q.title, { width: w - 24 });
    y = ensureSpace(doc, y, questionH + 20);
    doc.text(q.title, MARGIN + 12, y, { width: w - 24 });
    y += questionH + 14;

    for (let j = 0; j < options.length; j++) {
      const line = `${optionLabel(j)}. ${options[j]}`;
      const pad = 8;
      const textW = w - 32;
      const textH = doc.heightOfString(line, { width: textW });
      const boxH = textH + pad * 2;
      y = ensureSpace(doc, y, boxH + 8);

      doc.roundedRect(MARGIN + 8, y, w - 16, boxH, 4).fillAndStroke(OPTION_FILL, OPTION_BORDER);
      doc.font("Helvetica").fontSize(10).fillColor("#111827");
      doc.text(line, MARGIN + 16, y + pad, { width: textW });
      y += boxH + 8;
    }

    if (options.length === 0) {
      y = ensureSpace(doc, y, 36);
      doc.roundedRect(MARGIN + 8, y, w - 16, 28, 4).fillAndStroke(OPTION_FILL, OPTION_BORDER);
      doc.font("Helvetica-Oblique").fontSize(10).fillColor("#6b7280");
      doc.text("No options listed.", MARGIN + 16, y + 8, { width: w - 32 });
      y += 36;
    }

    const correctText = formatCorrectAnswer(q.correctAnswer, options);
    y += 4;
    y = ensureSpace(doc, y, 44);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#059669");
    doc.text("CORRECT ANSWER", MARGIN + 12, y);
    y += 14;

    const correctPad = 8;
    const correctTextW = w - 32;
    const correctTextH = doc.heightOfString(correctText, { width: correctTextW });
    const correctBoxH = correctTextH + correctPad * 2;
    y = ensureSpace(doc, y, correctBoxH + 8);
    doc.roundedRect(MARGIN + 8, y, w - 16, correctBoxH, 4).fillAndStroke(CORRECT_FILL, CORRECT_BORDER);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#065f46");
    doc.text(correctText, MARGIN + 16, y + correctPad, { width: correctTextW });
    y += correctBoxH + 12;

    y += 4;
    y = ensureSpace(doc, y, 50);
    doc.moveTo(MARGIN + 8, y).lineTo(MARGIN + w - 8, y).strokeColor("#e5e7eb").lineWidth(1).stroke();
    y += 10;

    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#2563eb");
    doc.text("EXPLANATION", MARGIN + 12, y);
    y += 14;

    doc.font("Helvetica").fontSize(10).fillColor("#374151");
    const explH = doc.heightOfString(explanation, { width: w - 24 });
    y = ensureSpace(doc, y, explH + 10);
    doc.text(explanation, MARGIN + 12, y, { width: w - 24 });
    y += explH + 22;
  }

  return pdfToBuffer(doc);
}
