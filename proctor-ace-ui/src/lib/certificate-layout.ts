export type CertificateLayoutElementId =
  | "brand"
  | "badge"
  | "presented"
  | "recipient"
  | "body"
  | "credential"
  | "issued"
  | "verify";

export type CertificateLayoutPosition = { x: number; y: number };
export type CertificateLayoutPositions = Record<CertificateLayoutElementId, CertificateLayoutPosition>;

export const DEFAULT_CERTIFICATE_LAYOUT: CertificateLayoutPositions = {
  brand: { x: 30, y: 14.8 },
  badge: { x: 30, y: 25 },
  presented: { x: 30, y: 33.5 },
  recipient: { x: 30, y: 38 },
  body: { x: 30, y: 51 },
  credential: { x: 30, y: 68 },
  issued: { x: 30, y: 73 },
  verify: { x: 30, y: 79 },
};
