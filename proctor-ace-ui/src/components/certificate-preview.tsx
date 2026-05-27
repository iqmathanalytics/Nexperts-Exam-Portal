import {
  buildRecognitionBodySegments,
  formatCertificateDate,
  formatCertificateDateShort,
} from "@/lib/certificate-utils";

export type CertificatePreviewData = {
  recipientName: string;
  examTitle: string;
  description?: string;
  credentialId: string;
  issuedOn: string;
  score: number;
};

type Props = {
  data: CertificatePreviewData;
  className?: string;
};

const COL = { left: "30%", width: "64.5%", footerBottom: "14%" } as const;

const FONT_LINKS = `
  @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Montserrat:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap');
`;

export function CertificatePreview({ data, className = "" }: Props) {
  const segments = buildRecognitionBodySegments({
    examTitle: data.examTitle,
    description: data.description,
    score: data.score,
    issuedOn: data.issuedOn,
  });

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg shadow-lg select-none ${className}`}
      style={{ aspectRatio: "842 / 595" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{FONT_LINKS}</style>

      <img
        src="/certificate-template.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />

      <div
        className="absolute text-left text-[#141414]"
        style={{ left: COL.left, top: "14.8%", width: COL.width, fontFamily: "'Montserrat', sans-serif" }}
      >
        <h1
          className="font-bold leading-[1.05] tracking-tight"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "clamp(30px, 5.2vw, 42px)",
          }}
        >
          CERTIFICATE
        </h1>

        <p
          className="mt-2 font-medium uppercase tracking-[0.32em]"
          style={{ fontSize: "clamp(11px, 1.65vw, 14px)" }}
        >
          OF COMPLETION
        </p>

        <p
          className="mt-7 font-bold uppercase tracking-[0.12em]"
          style={{ fontSize: "clamp(9px, 1.15vw, 10px)" }}
        >
          THIS CERTIFICATE IS PRESENTED TO
        </p>

        <div className="mt-3 inline-block w-fit max-w-full">
          <p
            className="leading-[1.05] text-[#C9A227]"
            style={{
              fontFamily: "'Great Vibes', 'Segoe Script', cursive",
              fontSize: "clamp(38px, 6.8vw, 58px)",
            }}
          >
            {data.recipientName}
          </p>
          <div className="mt-2 h-[2px] w-full bg-[#B8860B]" aria-hidden />
        </div>

        <p
          className="mt-6 font-normal leading-[1.65] text-[#252525]"
          style={{ fontSize: "clamp(11px, 1.55vw, 13.5px)" }}
        >
          {segments.map((seg, i) =>
            seg.bold ? (
              <strong key={i} className="font-bold text-[#141414]">
                {seg.text}
              </strong>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </p>
      </div>

      <div
        className="absolute text-left"
        style={{
          left: COL.left,
          bottom: COL.footerBottom,
          width: COL.width,
          fontFamily: "'Montserrat', sans-serif",
        }}
      >
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span
            className="font-bold uppercase tracking-wide"
            style={{ fontSize: "clamp(9px, 1.1vw, 10px)" }}
          >
            Credential ID:
          </span>
          <span className="font-medium text-[#252525]" style={{ fontSize: "clamp(10px, 1.25vw, 11.5px)" }}>
            {data.credentialId}
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3">
          <span
            className="font-bold uppercase tracking-wide"
            style={{ fontSize: "clamp(9px, 1.1vw, 10px)" }}
          >
            Issued date:
          </span>
          <span className="font-medium text-[#252525]" style={{ fontSize: "clamp(10px, 1.25vw, 11.5px)" }}>
            {formatCertificateDate(data.issuedOn)}
          </span>
        </div>
        <p className="mt-3 text-[#5C5C5C]" style={{ fontSize: "clamp(8px, 0.95vw, 8.5px)" }}>
          Verify at nexperts.io/certificate/{data.credentialId} · {formatCertificateDateShort(data.issuedOn)}
        </p>
      </div>
    </div>
  );
}
