import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildRecognitionBodySegments,
  formatIssuedDateLong,
  formatIssuedDateShort,
  type CertificateBodySegment,
} from "../lib/certificate-copy.js";
import layout from "../config/certificate-layout.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "../../assets");

export type CertificateHtmlInput = {
  recipientName: string;
  examTitle: string;
  description: string;
  credentialId: string;
  issuedOn: Date;
  score: number;
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bodyHtml(segments: CertificateBodySegment[]) {
  return segments
    .map((seg) =>
      seg.bold
        ? `<strong style="font-weight:700;color:#141414">${escapeHtml(seg.text)}</strong>`
        : escapeHtml(seg.text),
    )
    .join("");
}

function templateBackgroundDataUri(): string {
  const file = path.join(assetsDir, layout.templateFile);
  if (!fs.existsSync(file)) return "";
  const b64 = fs.readFileSync(file).toString("base64");
  return `data:image/png;base64,${b64}`;
}

/** HTML/CSS aligned with proctor-ace-ui/src/components/certificate-preview.tsx */
export function buildCertificateHtml(input: CertificateHtmlInput): string {
  const segments = buildRecognitionBodySegments(input);
  const issuedLong = formatIssuedDateLong(input.issuedOn);
  const issuedShort = formatIssuedDateShort(input.issuedOn);
  const bg = templateBackgroundDataUri();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Montserrat:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 842px; height: 595px; overflow: hidden; }
    .cert {
      position: relative;
      width: 842px;
      height: 595px;
      overflow: hidden;
      background: #fff;
    }
    .bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .main {
      position: absolute;
      left: 30%;
      top: 14.8%;
      width: 64.5%;
      text-align: left;
      color: #141414;
      font-family: 'Montserrat', Helvetica, Arial, sans-serif;
    }
    .title {
      font-family: 'Playfair Display', Georgia, serif;
      font-weight: 700;
      font-size: 42px;
      line-height: 1.05;
      letter-spacing: -0.02em;
    }
    .subtitle {
      margin-top: 8px;
      font-weight: 500;
      font-size: 14px;
      letter-spacing: 0.32em;
      text-transform: uppercase;
    }
    .presented {
      margin-top: 28px;
      font-weight: 700;
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .name-wrap {
      display: inline-block;
      margin-top: 12px;
      max-width: 100%;
    }
    .name {
      font-family: 'Great Vibes', 'Segoe Script', cursive;
      font-size: 58px;
      line-height: 1.05;
      color: #C9A227;
    }
    .name-line {
      margin-top: 8px;
      height: 2px;
      width: 100%;
      background: #B8860B;
    }
    .body {
      margin-top: 24px;
      font-weight: 400;
      font-size: 13.5px;
      line-height: 1.65;
      color: #252525;
    }
    .footer {
      position: absolute;
      left: 30%;
      bottom: 14%;
      width: 64.5%;
      font-family: 'Montserrat', Helvetica, Arial, sans-serif;
      text-align: left;
    }
    .footer-row {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0 12px;
      margin-bottom: 10px;
    }
    .footer-label {
      font-weight: 700;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #141414;
    }
    .footer-value {
      font-weight: 500;
      font-size: 11.5px;
      color: #252525;
    }
    .verify {
      margin-top: 12px;
      font-size: 8.5px;
      color: #5C5C5C;
    }
  </style>
</head>
<body>
  <div class="cert">
    ${bg ? `<img class="bg" src="${bg}" alt="" />` : ""}
    <div class="main">
      <h1 class="title">CERTIFICATE</h1>
      <p class="subtitle">OF COMPLETION</p>
      <p class="presented">THIS CERTIFICATE IS PRESENTED TO</p>
      <div class="name-wrap">
        <p class="name">${escapeHtml(input.recipientName)}</p>
        <div class="name-line"></div>
      </div>
      <p class="body">${bodyHtml(segments)}</p>
    </div>
    <div class="footer">
      <div class="footer-row">
        <span class="footer-label">Credential ID:</span>
        <span class="footer-value">${escapeHtml(input.credentialId)}</span>
      </div>
      <div class="footer-row">
        <span class="footer-label">Issued date:</span>
        <span class="footer-value">${escapeHtml(issuedLong)}</span>
      </div>
      <p class="verify">Verify at nexperts.io/certificate/${escapeHtml(input.credentialId)} · ${escapeHtml(issuedShort)}</p>
    </div>
  </div>
</body>
</html>`;
}
