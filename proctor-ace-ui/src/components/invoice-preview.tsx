export type InvoicePreviewData = {
  invoiceId: string;
  issuedAt: string;
  status: string;
  method: string;
  examTitle: string;
  examDescription: string;
  amount: number;
  subtotal: number;
  discountAmount: number;
  voucherCode: string | null;
  currency: string;
  billTo: {
    fullName: string;
    email: string;
    phone: string | null;
    icPassport: string | null;
  };
  company: {
    name: string;
    legalName: string;
    addressLines: string[];
    email: string;
    phone: string;
    website: string;
    taxId: string;
  };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function money(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
}

type Props = {
  data: InvoicePreviewData;
  className?: string;
};

export function InvoicePreview({ data, className = "" }: Props) {
  const brand = "#8B1538";
  const muted = "#666666";

  return (
    <div
      className={`overflow-hidden rounded-lg border border-border bg-white text-[#111111] shadow-sm ${className}`}
      style={{ fontFamily: "Helvetica, Arial, sans-serif" }}
    >
      {/* Header band */}
      <div className="px-6 py-5 text-white" style={{ backgroundColor: brand }}>
        <div className="text-[22px] font-bold leading-tight">{data.company.name}</div>
        <div className="mt-1 text-[9px] uppercase tracking-wide text-white/90">
          Tax invoice / receipt
        </div>
      </div>

      <div className="space-y-6 p-6 text-sm">
        {/* From + meta */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className="text-[10px] font-bold uppercase">From</div>
            <div className="mt-2 space-y-1 text-[9px] leading-relaxed" style={{ color: muted }}>
              <div>{data.company.legalName}</div>
              {data.company.addressLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
              <div>{data.company.email}</div>
              <div>{data.company.phone}</div>
              {data.company.taxId ? <div>Tax ID: {data.company.taxId}</div> : null}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase">Invoice details</div>
            <div className="mt-2 space-y-1 text-[9px] leading-relaxed" style={{ color: muted }}>
              <div>Invoice No: {data.invoiceId}</div>
              <div>Date: {formatDate(data.issuedAt)}</div>
              <div>Status: {data.status}</div>
              <div>Payment: {data.method}</div>
            </div>
          </div>
        </div>

        {/* Bill to */}
        <div>
          <div className="text-[10px] font-bold uppercase">Bill to</div>
          <div className="mt-2 space-y-1">
            <div className="text-[10px] font-medium">{data.billTo.fullName}</div>
            <div className="text-[9px]" style={{ color: muted }}>
              {data.billTo.email}
            </div>
            {data.billTo.phone ? (
              <div className="text-[9px]" style={{ color: muted }}>
                Phone: {data.billTo.phone}
              </div>
            ) : null}
            {data.billTo.icPassport ? (
              <div className="text-[9px]" style={{ color: muted }}>
                IC / Passport: {data.billTo.icPassport}
              </div>
            ) : null}
          </div>
        </div>

        {/* Line items */}
        <div>
          <div className="grid grid-cols-[1fr_auto] gap-2 rounded bg-[#f4f4f5] px-3 py-2 text-[9px] font-bold uppercase">
            <span>Description</span>
            <span>Amount</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-[#e5e5e5] px-3 py-3">
            <div>
              <div className="text-[10px] font-medium">{data.examTitle}</div>
              {data.examDescription ? (
                <div className="mt-1 text-[8px] leading-snug" style={{ color: muted }}>
                  {data.examDescription.slice(0, 180)}
                </div>
              ) : null}
            </div>
            <div className="text-right text-[10px] font-medium">
              {money(data.subtotal, data.currency)}
            </div>
          </div>

          {data.voucherCode && data.discountAmount > 0 ? (
            <div
              className="grid grid-cols-[1fr_auto] gap-2 border-b border-[#e5e5e5] px-3 py-2 text-[9px]"
              style={{ color: muted }}
            >
              <span>Voucher ({data.voucherCode})</span>
              <span className="text-right">-{money(data.discountAmount, data.currency)}</span>
            </div>
          ) : null}

          <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-3">
            <span className="text-[11px] font-bold">Total paid</span>
            <span className="text-right text-[11px] font-bold" style={{ color: brand }}>
              {money(data.amount, data.currency)}
            </span>
          </div>
        </div>

        <p className="text-[9px] leading-relaxed" style={{ color: muted }}>
          Thank you for your purchase. This invoice confirms payment for your exam registration.
          Please retain this document for your records.
        </p>

        {data.company.website ? (
          <p className="text-center text-[9px]" style={{ color: muted }}>
            {data.company.website}
          </p>
        ) : null}
      </div>
    </div>
  );
}
