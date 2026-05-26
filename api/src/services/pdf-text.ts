export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const mod = await import("pdf-parse");
  const pdfParse = (mod as { default?: (b: Buffer) => Promise<{ text?: string }> }).default ?? mod;
  const data = await (pdfParse as (b: Buffer) => Promise<{ text?: string }>)(buffer);
  const text = (data.text ?? "").replace(/\s+/g, " ").trim();
  return text.slice(0, 50000);
}
