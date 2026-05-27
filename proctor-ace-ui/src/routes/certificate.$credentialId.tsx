import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { CertificatePreview } from "@/components/certificate-preview";

export const Route = createFileRoute("/certificate/$credentialId")({
  component: PublicCertificatePage,
});

type PublicCert = {
  credentialId: string;
  recipientName: string;
  examTitle: string;
  examDescription?: string;
  category: string;
  score: number;
  issuedOn: string;
  verified: boolean;
};

function PublicCertificatePage() {
  const { credentialId } = Route.useParams();
  const [cert, setCert] = useState<PublicCert | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const blockContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", blockContextMenu);
    return () => document.removeEventListener("contextmenu", blockContextMenu);
  }, []);

  useEffect(() => {
    const api = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
    fetch(`${api}/api/certificates/public/${encodeURIComponent(credentialId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Certificate not found");
        return r.json() as Promise<PublicCert>;
      })
      .then(setCert)
      .catch(() => setError("This certificate could not be verified. Check the link and try again."));
  }, [credentialId]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
        <BrandLogo to="/" variant="default" />
        <p className="mt-8 text-center text-muted-foreground">{error}</p>
        <a href="/" className="mt-4 text-sm font-medium text-accent hover:underline">
          Back to portal
        </a>
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Verifying certificate…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <BrandLogo to="/" variant="default" />
          {cert.verified && (
            <div className="flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
              <ShieldCheck className="h-4 w-4" />
              <CheckCircle2 className="h-4 w-4" />
              Verified credential
            </div>
          )}
        </div>

        <div
          className="select-none"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        >
          <CertificatePreview
            data={{
              recipientName: cert.recipientName,
              examTitle: cert.examTitle,
              description: cert.examDescription,
              credentialId: cert.credentialId,
              issuedOn: cert.issuedOn,
              score: cert.score,
            }}
          />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          This page verifies completion of a proctored Nexperts Academy certification exam
          {cert.category ? ` · ${cert.category}` : ""}.
        </p>
      </div>
    </div>
  );
}
