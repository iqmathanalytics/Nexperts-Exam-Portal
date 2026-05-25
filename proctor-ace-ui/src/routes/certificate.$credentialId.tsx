import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Award, ShieldCheck, CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { formatAttemptDate } from "@/lib/format-datetime";

export const Route = createFileRoute("/certificate/$credentialId")({
  component: PublicCertificatePage,
});

type PublicCert = {
  credentialId: string;
  recipientName: string;
  examTitle: string;
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
        <a href="/" className="mt-4 text-sm font-medium text-accent hover:underline">Back to portal</a>
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
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex justify-center">
          <BrandLogo to="/" variant="default" />
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-elevated">
          <div className="relative bg-gradient-hero p-10 text-white">
            <div className="absolute inset-0 grid-bg opacity-30" />
            <div className="relative space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-accent">
                  <ShieldCheck className="h-4 w-4" /> NExperts Verified
                </div>
                {cert.verified && (
                  <div className="flex items-center gap-1 rounded-full bg-success/20 px-3 py-1 text-xs text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Authentic
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-white/60">Certificate of Achievement</div>
                <h1 className="mt-2 font-display text-3xl font-bold">{cert.examTitle}</h1>
                <div className="mt-1 text-sm text-white/70">{cert.category}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/50">Awarded to</div>
                <div className="font-display text-2xl font-semibold">{cert.recipientName}</div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/50">Score</div>
                  <div className="font-display text-3xl font-bold text-gold">{cert.score}%</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-white/50">Issued</div>
                  <div>{formatAttemptDate(cert.issuedOn)}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 border-t p-6 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Award className="h-4 w-4 text-accent" />
              <span>Credential ID</span>
            </div>
            <span className="font-mono text-xs">{cert.credentialId}</span>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          This page verifies completion of a proctored NExperts certification exam.
        </p>
      </div>
    </div>
  );
}
