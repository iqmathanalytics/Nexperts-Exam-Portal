/** Shared certificate title — keep in sync with api/src/services/certificate-html.ts */
export function CertificateHeading({
  brandName = "VENTRIX GLOBAL",
  badgeText = "CERTIFIED",
}: {
  brandName?: string;
  badgeText?: string;
} = {}) {
  return (
    <div className="cert-heading">
      <p className="cert-heading-brand">{brandName}</p>
      <div className="cert-heading-rule" aria-hidden>
        <span className="cert-heading-rule-line" />
        <span className="cert-heading-rule-gem">◆</span>
        <span className="cert-heading-rule-line" />
      </div>
      <p className="cert-heading-badge">{badgeText}</p>
    </div>
  );
}

export const CERTIFICATE_HEADING_STYLES = `
  .cert-heading { margin-bottom: 2px; }
  .cert-heading-brand {
    font-family: 'Montserrat', sans-serif;
    font-weight: 800;
    font-size: clamp(20px, 3.4vw, 30px);
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
    font-family: 'Montserrat', sans-serif;
    font-weight: 600;
    font-size: clamp(14px, 2.2vw, 20px);
    letter-spacing: 0.62em;
    text-indent: 0.62em;
    line-height: 1.2;
    text-transform: uppercase;
    color: #9A7B1A;
    text-shadow: 0 1px 0 rgba(255,255,255,0.6);
  }
`;
