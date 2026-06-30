import {
  buildRecognitionBodySegments,
  formatCertificateDate,
  formatCertificateDateShort,
} from "@/lib/certificate-utils";
import { CERTIFICATE_HEADING_STYLES } from "@/components/certificate-heading";
import { useRef, useState, type PointerEvent } from "react";
import {
  DEFAULT_CERTIFICATE_LAYOUT,
  type CertificateLayoutElementId,
  type CertificateLayoutPosition,
  type CertificateLayoutPositions,
} from "@/lib/certificate-layout";

export type CertificatePreviewData = {
  recipientName: string;
  examTitle: string;
  description?: string;
  credentialId: string;
  issuedOn: string;
  score: number;
};

export type CertificateBrandingOverrides = {
  brandName?: string;
  badgeText?: string;
  presentedLabel?: string;
  bodyTemplate?: string;
  verifyBaseUrl?: string;
  recipientNameFont?: string;
  bodyFont?: string;
  recipientNameAlign?: "left" | "center" | "right";
  bodyAlign?: "left" | "center" | "right";
  templateImageUrl?: string;
};

type Props = {
  data: CertificatePreviewData;
  className?: string;
  overrides?: CertificateBrandingOverrides;
  /** When true, score/date/credential are shown as bracket placeholders */
  previewMode?: boolean;
  editableLayout?: boolean;
  layoutPositions?: Partial<CertificateLayoutPositions>;
  onLayoutPositionsChange?: (positions: CertificateLayoutPositions) => void;
};

const FONT_LINKS = `
  @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Montserrat:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap');
  ${CERTIFICATE_HEADING_STYLES}
`;

const PREVIEW_SEGMENTS = [
  { text: "In recognition of outstanding achievement in the " },
  { text: "[ Exam Title ]", bold: true },
  { text: " professional certification examination, with a final score of " },
  { text: "[ Score ]", bold: true },
  { text: ". Issued on " },
  { text: "[ Date ]", bold: true },
  { text: "." },
];

function mergeLayout(layout?: Partial<CertificateLayoutPositions>): CertificateLayoutPositions {
  return {
    ...DEFAULT_CERTIFICATE_LAYOUT,
    ...layout,
  };
}

function clampPercent(value: number) {
  return Math.min(96, Math.max(0, value));
}

export function CertificatePreview({
  data,
  className = "",
  overrides = {},
  previewMode = false,
  editableLayout = false,
  layoutPositions,
  onLayoutPositionsChange,
}: Props) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{
    id: CertificateLayoutElementId;
    pointerId: number;
    startX: number;
    startY: number;
    origin: CertificateLayoutPosition;
  } | null>(null);
  const verifyBase = overrides.verifyBaseUrl ?? "www.ventrix.global/certificate/";
  const recipientNameFont = overrides.recipientNameFont ?? "'Great Vibes', 'Segoe Script', cursive";
  const bodyFont = overrides.bodyFont ?? "'Montserrat', Helvetica, Arial, sans-serif";
  const recipientNameAlign = overrides.recipientNameAlign ?? "center";
  const bodyAlign = overrides.bodyAlign ?? "left";
  const imgSrc = overrides.templateImageUrl ?? "/certificate-template.png";
  const bodyOverride = overrides.bodyTemplate;
  const positions = mergeLayout(layoutPositions);

  const segments = (() => {
    if (previewMode && bodyOverride) return [{ text: bodyOverride }];
    if (previewMode) return PREVIEW_SEGMENTS;
    return buildRecognitionBodySegments({
      examTitle: data.examTitle,
      description: data.description,
      score: data.score,
      issuedOn: data.issuedOn,
    });
  })();

  const updatePosition = (id: CertificateLayoutElementId, next: CertificateLayoutPosition) => {
    onLayoutPositionsChange?.({
      ...positions,
      [id]: next,
    });
  };

  const startDrag = (id: CertificateLayoutElementId, e: PointerEvent<HTMLDivElement>) => {
    if (!editableLayout) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origin: positions[id],
    });
  };

  const moveDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || !previewRef.current || e.pointerId !== drag.pointerId) return;
    const rect = previewRef.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.startX) / rect.width) * 100;
    const dy = ((e.clientY - drag.startY) / rect.height) * 100;
    updatePosition(drag.id, {
      x: clampPercent(drag.origin.x + dx),
      y: clampPercent(drag.origin.y + dy),
    });
  };

  const stopDrag = () => setDrag(null);

  const blockProps = (id: CertificateLayoutElementId, width = "64.5%") => ({
    className: `absolute z-10 text-left ${editableLayout ? "cursor-move rounded-sm outline outline-1 outline-transparent hover:outline-primary/70" : ""}`,
    style: {
      left: `${positions[id].x}%`,
      top: `${positions[id].y}%`,
      width,
      fontFamily: "'Montserrat', sans-serif",
      userSelect: "none" as const,
      touchAction: "none" as const,
    },
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => startDrag(id, e),
  });

  return (
    <div
      ref={previewRef}
      className={`relative w-full overflow-hidden rounded-lg shadow-lg select-none ${className}`}
      style={{ aspectRatio: "842 / 595" }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerMove={moveDrag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      <style>{FONT_LINKS}</style>

      <img
        src={imgSrc}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />

      <div {...blockProps("recipient", "64.5%")}>
        <p
          className="leading-[1.05] text-[#C9A227]"
          style={{
            fontFamily: recipientNameFont,
            fontSize: "clamp(38px, 6.8vw, 58px)",
            textAlign: recipientNameAlign,
          }}
        >
          {data.recipientName}
        </p>
        <div className="mt-2 h-[2px] w-full bg-[#B8860B]" aria-hidden />
      </div>

      <div {...blockProps("body", "64.5%")}>
        <p
          className="font-normal leading-[1.65] text-[#252525]"
          style={{ fontFamily: bodyFont, fontSize: "clamp(11px, 1.55vw, 13.5px)", textAlign: bodyAlign }}
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

      <div {...blockProps("credential", "64.5%")}>
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
      </div>

      <div {...blockProps("issued", "64.5%")}>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span
            className="font-bold uppercase tracking-wide"
            style={{ fontSize: "clamp(9px, 1.1vw, 10px)" }}
          >
            Issued date:
          </span>
          <span className="font-medium text-[#252525]" style={{ fontSize: "clamp(10px, 1.25vw, 11.5px)" }}>
            {previewMode ? "[ Date ]" : formatCertificateDate(data.issuedOn)}
          </span>
        </div>
      </div>

      <div {...blockProps("verify", "64.5%")}>
        <p className="text-[#5C5C5C]" style={{ fontSize: "clamp(8px, 0.95vw, 8.5px)" }}>
          Verify at {verifyBase}{data.credentialId} · {previewMode ? "[ Date ]" : formatCertificateDateShort(data.issuedOn)}
        </p>
      </div>
    </div>
  );
}
