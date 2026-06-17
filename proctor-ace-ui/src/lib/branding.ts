/** Site-wide branding — Ventrix Global */
export const BRAND = {
  name: "Ventrix Global",
  shortName: "Ventrix",
  tagline: "Enterprise certification & secure exam delivery",
  academy: "Ventrix Global",
  copyright: "Ventrix Global",
  website: "https://www.ventrix.global",
  supportEmail: "support@ventrix.global",
  logoPath: "/ventrix_logo.png",
  certificateHeading: "VENTRIX GLOBAL CERTIFIED",
} as const;

export function pageTitle(page: string) {
  return `${page} — ${BRAND.name}`;
}
