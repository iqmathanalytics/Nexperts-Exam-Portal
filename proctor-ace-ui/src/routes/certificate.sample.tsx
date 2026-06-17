import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand-logo";
import { CertificatePreview } from "@/components/certificate-preview";
import { BRAND } from "@/lib/branding";
import { Badge } from "@/components/ui/badge";

const SAMPLE = {
  recipientName: "Alexandra Chen",
  examTitle: "Professional Cloud Architect",
  description: "Demonstrated mastery of cloud infrastructure design, security, and operations.",
  credentialId: "VG-SAMPLE-2026",
  issuedOn: new Date().toISOString(),
  score: 92,
};

export const Route = createFileRoute("/certificate/sample")({
  component: SampleCertificatePage,
  head: () => ({ meta: [{ title: `Sample certificate — ${BRAND.name}` }] }),
});

function SampleCertificatePage() {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <BrandLogo to="/" variant="default" />
          <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent">
            Sample preview — not a live credential
          </Badge>
        </div>

        <CertificatePreview data={SAMPLE} />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          This sample shows the {BRAND.name} certificate layout for review. Share this link with stakeholders:
          {" "}
          <Link to="/certificate/sample" className="font-medium text-accent hover:underline">
            /certificate/sample
          </Link>
        </p>
      </div>
    </div>
  );
}
