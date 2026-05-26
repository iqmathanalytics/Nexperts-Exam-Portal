import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { launchHeadlessBrowser } from "../lib/puppeteer-launch.js";
import { buildCertificateHtml, type CertificateHtmlInput } from "./certificate-html.js";
import layout from "../config/certificate-layout.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "../../assets");

export type CertificatePdfInput = CertificateHtmlInput;

function templatePath(): string | null {
  const file = path.join(assetsDir, layout.templateFile);
  return fs.existsSync(file) ? file : null;
}

async function generateViaPuppeteer(html: string): Promise<Buffer> {
  const browser = await launchHeadlessBrowser();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 842, height: 595, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "load", timeout: 45_000 });
    await page.evaluateHandle("document.fonts.ready");

    const pdf = await page.pdf({
      width: "842px",
      height: "595px",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function generateCertificatePdf(input: CertificatePdfInput): Promise<Buffer> {
  if (!templatePath()) {
    throw new Error("Certificate template image not found");
  }

  const html = buildCertificateHtml(input);
  return generateViaPuppeteer(html);
}

export function certificateTemplateConfigured(): boolean {
  return templatePath() !== null;
}
