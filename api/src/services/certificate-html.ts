import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildRecognitionBodySegments,
  formatIssuedDateLong,
  formatIssuedDateShort,
  type CertificateBodySegment,
} from "../lib/certificate-copy.js";
import { prisma } from "../lib/prisma.js";
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

const CERT_DEFAULTS = {
  brandName: "VENTRIX GLOBAL",
  badgeText: "CERTIFIED",
  presentedLabel: "THIS CERTIFICATE IS PRESENTED TO",
  bodyTemplate: "In recognition of outstanding achievement in the [ Exam Title ] professional certification examination, with a final score of [ Score ]. Issued on [ Date ].",
  verifyBaseUrl: "www.ventrix.global/certificate/",
  recipientNameFont: "'Great Vibes', 'Segoe Script', cursive",
  bodyFont: "'Montserrat', Helvetica, Arial, sans-serif",
  recipientNameAlign: "center",
  bodyAlign: "left",
};

type LayoutElementId =
  | "brand"
  | "badge"
  | "presented"
  | "recipient"
  | "body"
  | "credential"
  | "issued"
  | "verify";

type LayoutPositions = Record<LayoutElementId, { x: number; y: number }>;

const DEFAULT_LAYOUT: LayoutPositions = {
  brand: { x: 30, y: 14.8 },
  badge: { x: 30, y: 25 },
  presented: { x: 30, y: 33.5 },
  recipient: { x: 30, y: 38 },
  body: { x: 30, y: 51 },
  credential: { x: 30, y: 68 },
  issued: { x: 30, y: 73 },
  verify: { x: 30, y: 79 },
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

function templateBodyHtml(template: string, input: CertificateHtmlInput, issuedLong: string) {
  return escapeHtml(template)
    .replace(/\[\s*exam title\s*\]/gi, `<strong style="font-weight:700;color:#141414">${escapeHtml(input.examTitle)}</strong>`)
    .replace(/\[\s*score\s*\]/gi, `<strong style="font-weight:700;color:#141414">${input.score}%</strong>`)
    .replace(/\[\s*date\s*\]/gi, `<strong style="font-weight:700;color:#141414">${escapeHtml(issuedLong)}</strong>`);
}

function parseLayout(layoutJson?: string | null): LayoutPositions {
  if (!layoutJson) return DEFAULT_LAYOUT;
  try {
    return {
      ...DEFAULT_LAYOUT,
      ...(JSON.parse(layoutJson) as Partial<LayoutPositions>),
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function posCss(layout: LayoutPositions, id: LayoutElementId, width = "64.5%") {
  const pos = layout[id];
  return `left:${pos.x}%;top:${pos.y}%;width:${width}`;
}

function templateBackgroundDataUri(): string {
  const file = path.join(assetsDir, layout.templateFile);
  if (!fs.existsSync(file)) return "";
  const b64 = fs.readFileSync(file).toString("base64");
  return `data:image/png;base64,${b64}`;
}

/** HTML/CSS aligned with proctor-ace-ui/src/components/certificate-preview.tsx */
export async function buildCertificateHtml(input: CertificateHtmlInput): Promise<string> {
  const dbConfig = await prisma.certificateConfig.findUnique({ where: { id: "default" } }).catch(() => null);
  const cfg = {
    brandName: dbConfig?.brandName ?? CERT_DEFAULTS.brandName,
    badgeText: dbConfig?.badgeText ?? CERT_DEFAULTS.badgeText,
    presentedLabel: dbConfig?.presentedLabel ?? CERT_DEFAULTS.presentedLabel,
    bodyTemplate: dbConfig?.bodyTemplate ?? CERT_DEFAULTS.bodyTemplate,
    verifyBaseUrl: dbConfig?.verifyBaseUrl ?? CERT_DEFAULTS.verifyBaseUrl,
    recipientNameFont: dbConfig?.recipientNameFont ?? CERT_DEFAULTS.recipientNameFont,
    bodyFont: dbConfig?.bodyFont ?? CERT_DEFAULTS.bodyFont,
    recipientNameAlign: dbConfig?.recipientNameAlign ?? CERT_DEFAULTS.recipientNameAlign,
    bodyAlign: dbConfig?.bodyAlign ?? CERT_DEFAULTS.bodyAlign,
    layout: parseLayout(dbConfig?.layoutJson),
  };

  const segments = buildRecognitionBodySegments(input);
  const issuedLong = formatIssuedDateLong(input.issuedOn);
  const issuedShort = formatIssuedDateShort(input.issuedOn);
  const bg = templateBackgroundDataUri();
  const bodyContent = cfg.bodyTemplate
    ? templateBodyHtml(cfg.bodyTemplate, input, issuedLong)
    : bodyHtml(segments);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Montserrat:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
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
      z-index: 0;
    }
    .text-block {
      position: absolute;
      z-index: 10;
      text-align: left;
      color: #141414;
      font-family: 'Montserrat', Helvetica, Arial, sans-serif;
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
    .cert-heading { margin-bottom: 2px; }
    .cert-heading-brand {
      font-family: 'Montserrat', Helvetica, Arial, sans-serif;
      font-weight: 800;
      font-size: 30px;
      letter-spacing: 0.28em;
      text-indent: 0.28em;
      line-height: 1.15;
      text-transform: uppercase;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #2563eb 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .cert-heading-rule {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 10px 0 8px;
      max-width: 280px;
    }
    .cert-heading-rule-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, transparent, #B8860B 20%, #D4AF37 50%, #B8860B 80%, transparent);
    }
    .cert-heading-rule-gem {
      color: #C9A227;
      font-size: 7px;
      line-height: 1;
    }
    .cert-heading-badge {
      font-family: 'Montserrat', Helvetica, Arial, sans-serif;
      font-weight: 600;
      font-size: 20px;
      letter-spacing: 0.62em;
      text-indent: 0.62em;
      line-height: 1.2;
      text-transform: uppercase;
      color: #9A7B1A;
    }
    .presented {
      font-weight: 700;
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .name-wrap {
      display: inline-block;
      max-width: 100%;
    }
    .name {
      font-family: ${cfg.recipientNameFont};
      font-size: 58px;
      line-height: 1.05;
      color: #C9A227;
      text-align: ${cfg.recipientNameAlign};
    }
    .name-line {
      margin-top: 8px;
      height: 2px;
      width: 100%;
      background: #B8860B;
    }
    .body {
      font-family: ${cfg.bodyFont};
      font-weight: 400;
      font-size: 13.5px;
      line-height: 1.65;
      color: #252525;
      text-align: ${cfg.bodyAlign};
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
      font-size: 8.5px;
      color: #5C5C5C;
    }
  </style>
</head>
<body>
  <div class="cert">
    ${bg ? `<img class="bg" src="${bg}" alt="" />` : ""}
    <div class="text-block" style="${posCss(cfg.layout, "recipient")}">
      <div class="name-wrap">
        <p class="name">${escapeHtml(input.recipientName)}</p>
        <div class="name-line"></div>
      </div>
    </div>
    <div class="text-block" style="${posCss(cfg.layout, "body")}">
      <p class="body">${bodyContent}</p>
    </div>
    <div class="text-block" style="${posCss(cfg.layout, "credential")}">
      <div class="footer-row">
        <span class="footer-label">Credential ID:</span>
        <span class="footer-value">${escapeHtml(input.credentialId)}</span>
      </div>
    </div>
    <div class="text-block" style="${posCss(cfg.layout, "issued")}">
      <div class="footer-row">
        <span class="footer-label">Issued date:</span>
        <span class="footer-value">${escapeHtml(issuedLong)}</span>
      </div>
    </div>
    <div class="text-block" style="${posCss(cfg.layout, "verify")}">
      <p class="verify">Verify at ${escapeHtml(cfg.verifyBaseUrl)}${escapeHtml(input.credentialId)} · ${escapeHtml(issuedShort)}</p>
    </div>
  </div>
</body>
</html>`;
}
