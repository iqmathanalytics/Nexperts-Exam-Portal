/** Shared certificate copy — keep in sync with proctor-ace-ui/src/lib/certificate-utils.ts */

function truncate(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim().replace(/[.,;]+$/, "");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function formatCertDescription(text: string): string {
  const t = truncate(text, 140);
  if (!t) return "";
  const lower = t.toLowerCase();
  return lower.replace(/\bsoc\b/g, "SOC");
}

export function formatIssuedDateLong(d: Date) {
  return d.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatIssuedDateShort(d: Date) {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export type CertificateBodySegment = { text: string; bold?: boolean };

export function buildRecognitionBodySegments(opts: {
  examTitle: string;
  description: string;
  score: number;
  issuedOn: Date;
}): CertificateBodySegment[] {
  const date = formatIssuedDateLong(opts.issuedOn);
  const exam = opts.examTitle.trim();
  const desc = formatCertDescription(opts.description);
  const scoreStr = `${opts.score}%`;

  if (desc && desc.toLowerCase() !== exam.toLowerCase()) {
    return [
      { text: "In recognition of outstanding achievement in the " },
      { text: exam, bold: true },
      { text: " professional certification examination, having demonstrated proficiency in " },
      { text: desc },
      { text: ", with a final score of " },
      { text: scoreStr, bold: true },
      { text: ". Issued on " },
      { text: date, bold: true },
      { text: "." },
    ];
  }

  return [
    { text: "In recognition of outstanding achievement in the " },
    { text: exam, bold: true },
    { text: " professional certification examination, with a final score of " },
    { text: scoreStr, bold: true },
    { text: ". Issued on " },
    { text: date, bold: true },
    { text: "." },
  ];
}

/** Layout constants — 842×595, matches certificate-preview.tsx percentages */
export const CERT_PAGE = { width: 842, height: 595 } as const;

export const CERT_LAYOUT = {
  left: CERT_PAGE.width * 0.3,
  width: CERT_PAGE.width * 0.645,
  top: CERT_PAGE.height * 0.148,
  footerBottom: CERT_PAGE.height * 0.14,
} as const;
