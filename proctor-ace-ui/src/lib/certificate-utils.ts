export function scoreTier(score: number): { label: string; accentClass: string } {
  if (score >= 95) return { label: "Outstanding Achievement", accentClass: "text-[#B8860B]" };
  if (score >= 85) return { label: "Excellent Performance", accentClass: "text-[#8B1538]" };
  if (score >= 75) return { label: "Merit Achievement", accentClass: "text-[#6B1029]" };
  if (score >= 60) return { label: "Successful Completion", accentClass: "text-[#3D3D4E]" };
  return { label: "Certified Completion", accentClass: "text-[#6B6B7B]" };
}

export function formatCertificateDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatCertificateDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function truncateDescription(text: string, max = 160) {
  const t = text.replace(/\s+/g, " ").trim().replace(/[.,;]+$/, "");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/** Clean exam description for certificate body copy */
export function formatCertDescription(text: string): string {
  const t = truncateDescription(text, 140);
  if (!t) return "";
  const lower = t.toLowerCase();
  return lower.replace(/\bsoc\b/g, "SOC");
}

export type CertificateBodySegment = { text: string; bold?: boolean };

export function buildRecognitionBodySegments(opts: {
  examTitle: string;
  description?: string;
  score: number;
  issuedOn: string;
}): CertificateBodySegment[] {
  const date = formatCertificateDate(opts.issuedOn);
  const exam = opts.examTitle.trim();
  const desc = formatCertDescription(opts.description || "");
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

export function buildRecognitionParagraph(opts: {
  examTitle: string;
  description?: string;
  score: number;
  issuedOn: string;
}): string {
  return buildRecognitionBodySegments(opts)
    .map((s) => s.text)
    .join("");
}
