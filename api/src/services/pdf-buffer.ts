import type PDFDocument from "pdfkit";
import type { Response } from "express";

export function pdfToBuffer(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export function sendPdfDownload(res: Response, pdf: Buffer, filename: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", String(pdf.length));
  res.setHeader("Cache-Control", "no-store");
  res.send(pdf);
}

/** JSON transport avoids CORS/IDM issues with binary .pdf URLs in the browser */
export function sendPdfJson(res: Response, pdf: Buffer, filename: string) {
  res.json({
    pdfBase64: pdf.toString("base64"),
    filename,
    contentType: "application/pdf",
  });
}
