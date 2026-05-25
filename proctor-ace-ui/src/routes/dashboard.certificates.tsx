import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Award, Download, Share2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { Button } from "@/components/ui/button";
import { apiAuth } from "@/lib/api-auth";
import { getAuth } from "@/lib/auth";
import { usePageDataLoad } from "@/contexts/page-load-context";

export const Route = createFileRoute("/dashboard/certificates")({
  component: Certificates,
});

type Cert = {
  id: string;
  examTitle: string;
  issuedOn: string;
  score: number;
  credentialId: string;
  shareUrl?: string;
};

function Certificates() {
  const [certs, setCerts] = useState<Cert[]>([]);
  const userName = getAuth()?.fullName ?? "Candidate";

  usePageDataLoad(
    "certificates",
    async () => {
      const d = await apiAuth<{ certificates: Cert[] }>("/api/candidate/certificates");
      setCerts(d.certificates);
    },
    [],
  );

  const shareLink = (credentialId: string) => {
    const path = `/certificate/${credentialId}`;
    return `${window.location.origin}${path}`;
  };

  const copyShare = async (credentialId: string) => {
    const url = shareLink(credentialId);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.info(url, { description: "Copy this link to share your certificate" });
    }
  };

  return (
    <>
      <PageHeader title="Certificates" sub="Download and share your verified credentials." />

      {certs.length === 0 ? (
        <EmptyState icon={Award} title="No certificates yet" sub="Pass your first exam to earn one." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {certs.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-elevated">
              <div className="relative bg-gradient-hero p-8 text-white">
                <div className="absolute inset-0 grid-bg opacity-30" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-accent">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </div>
                  <div className="mt-4 font-display text-xs uppercase tracking-wider text-white/60">
                    Certificate of Achievement
                  </div>
                  <h3 className="mt-2 font-display text-2xl font-bold leading-tight">{c.examTitle}</h3>
                  <div className="mt-6">
                    <div className="text-[10px] uppercase tracking-wider text-white/50">Awarded to</div>
                    <div className="font-display text-xl">{userName}</div>
                  </div>
                  <div className="mt-6 flex items-end justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/50">Score</div>
                      <div className="font-display text-2xl font-bold text-gold">{c.score}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-white/50">Issued</div>
                      <div className="text-sm">{c.issuedOn}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Credential ID</span>
                  <span className="font-mono">{c.credentialId}</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1 bg-gradient-emerald text-white" onClick={() => toast.success("Certificate downloaded")}>
                    <Download className="mr-2 h-4 w-4" /> Download
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={shareLink(c.credentialId)} target="_blank" rel="noopener noreferrer" title="Open share page">
                      <Share2 className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button variant="outline" onClick={() => copyShare(c.credentialId)} title="Copy share link">
                    Copy link
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
