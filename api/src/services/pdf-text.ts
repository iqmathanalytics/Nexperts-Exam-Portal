import { PDFParse } from "pdf-parse";

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text = (result.text ?? "").replace(/\s+/g, " ").trim();
    return text.slice(0, 50000);
  } finally {
    await parser.destroy();
  }
}
