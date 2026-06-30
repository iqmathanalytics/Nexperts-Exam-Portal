import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ImageIcon, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  CertificatePreview,
  type CertificateBrandingOverrides,
} from "@/components/certificate-preview";
import {
  DEFAULT_CERTIFICATE_LAYOUT,
  type CertificateLayoutPositions,
} from "@/lib/certificate-layout";
import { apiAuth } from "@/lib/api-auth";
import { apiBase } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

export const Route = createFileRoute("/admin/certificate-template")({
  component: AdminCertificateTemplate,
});

type CertConfig = {
  brandName: string;
  badgeText: string;
  presentedLabel: string;
  bodyTemplate: string | null;
  verifyBaseUrl: string;
  recipientNameFont: string;
  bodyFont: string;
  recipientNameAlign: "left" | "center" | "right";
  bodyAlign: "left" | "center" | "right";
  layoutJson?: string | null;
};

const DEFAULT_BODY =
  "In recognition of outstanding achievement in the [ Exam Title ] professional certification examination, with a final score of [ Score ]. Issued on [ Date ].";

const DEFAULTS: CertConfig = {
  brandName: "VENTRIX GLOBAL",
  badgeText: "CERTIFIED",
  presentedLabel: "THIS CERTIFICATE IS PRESENTED TO",
  bodyTemplate: DEFAULT_BODY,
  verifyBaseUrl: "www.ventrix.global/certificate/",
  recipientNameFont: "'Great Vibes', 'Segoe Script', cursive",
  bodyFont: "'Montserrat', Helvetica, Arial, sans-serif",
  recipientNameAlign: "center",
  bodyAlign: "left",
  layoutJson: null,
};

const RECIPIENT_FONT_OPTIONS = [
  { label: "Great Vibes", value: "'Great Vibes', 'Segoe Script', cursive" },
  { label: "Playfair Display", value: "'Playfair Display', Georgia, serif" },
  { label: "Montserrat", value: "'Montserrat', Helvetica, Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
];

const BODY_FONT_OPTIONS = [
  { label: "Montserrat", value: "'Montserrat', Helvetica, Arial, sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', Georgia, serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
];

const ALIGN_OPTIONS = [
  { label: "Left align", value: "left" },
  { label: "Center align", value: "center" },
  { label: "Right align", value: "right" },
] as const;

const PLACEHOLDER_DATA = {
  recipientName: "[ Recipient Name ]",
  examTitle: "[ Exam Title ]",
  description: "",
  credentialId: "[ NX-XXXX-XXXXXX ]",
  issuedOn: new Date().toISOString(),
  score: 100,
};

function parseLayout(layoutJson?: string | null): CertificateLayoutPositions {
  if (!layoutJson) return DEFAULT_CERTIFICATE_LAYOUT;
  try {
    return {
      ...DEFAULT_CERTIFICATE_LAYOUT,
      ...(JSON.parse(layoutJson) as Partial<CertificateLayoutPositions>),
    };
  } catch {
    return DEFAULT_CERTIFICATE_LAYOUT;
  }
}

function normalizeConfig(config: Partial<CertConfig>): CertConfig {
  return {
    ...DEFAULTS,
    ...config,
    bodyTemplate: config.bodyTemplate ?? DEFAULT_BODY,
    recipientNameFont: config.recipientNameFont || DEFAULTS.recipientNameFont,
    bodyFont: config.bodyFont || DEFAULTS.bodyFont,
    recipientNameAlign: config.recipientNameAlign || DEFAULTS.recipientNameAlign,
    bodyAlign: config.bodyAlign || DEFAULTS.bodyAlign,
    verifyBaseUrl: config.verifyBaseUrl || DEFAULTS.verifyBaseUrl,
  };
}

function AdminCertificateTemplate() {
  const [config, setConfig] = useState<CertConfig>(DEFAULTS);
  const [saved, setSaved] = useState<CertConfig>(DEFAULTS);
  const [layoutPositions, setLayoutPositions] = useState<CertificateLayoutPositions>(DEFAULT_CERTIFICATE_LAYOUT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiAuth<{ config: Partial<CertConfig> }>("/api/admin/certificate-config")
      .then((d) => {
        const normalized = normalizeConfig(d.config);
        setConfig(normalized);
        setSaved(normalized);
        setLayoutPositions(parseLayout(normalized.layoutJson));
      })
      .catch((err: unknown) => toast.error(`Load failed: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => setLoading(false));
  }, []);

  const isDirty =
    JSON.stringify(config) !== JSON.stringify(saved) ||
    JSON.stringify(layoutPositions) !== JSON.stringify(parseLayout(saved.layoutJson)) ||
    imageFile !== null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (imageFile) {
        setUploadingImage(true);
        const form = new FormData();
        form.append("image", imageFile);
        const token = getToken();
        const res = await fetch(`${apiBase}/api/admin/certificate-config/image`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token ?? ""}` },
          body: form,
        });
        if (!res.ok) throw new Error("Image upload failed");
        setUploadingImage(false);
        setImageFile(null);
      }

      const updated = await apiAuth<{ config: CertConfig }>("/api/admin/certificate-config", {
        method: "PUT",
        body: JSON.stringify({
          ...config,
          brandName: DEFAULTS.brandName,
          badgeText: DEFAULTS.badgeText,
          presentedLabel: DEFAULTS.presentedLabel,
          layoutJson: JSON.stringify(layoutPositions),
        }),
      });
      setConfig(updated.config);
      setSaved(updated.config);
      setLayoutPositions(parseLayout(updated.config.layoutJson));
      toast.success("Certificate template saved");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  };

  const handleReset = () => {
    setConfig(saved);
    setLayoutPositions(parseLayout(saved.layoutJson));
    setImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const overrides: CertificateBrandingOverrides = {
    brandName: DEFAULTS.brandName,
    badgeText: DEFAULTS.badgeText,
    presentedLabel: DEFAULTS.presentedLabel,
    bodyTemplate: config.bodyTemplate ?? DEFAULT_BODY,
    verifyBaseUrl: config.verifyBaseUrl,
    recipientNameFont: config.recipientNameFont,
    bodyFont: config.bodyFont,
    recipientNameAlign: config.recipientNameAlign,
    bodyAlign: config.bodyAlign,
    ...(imagePreviewUrl ? { templateImageUrl: imagePreviewUrl } : {}),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Certificate Template"
          sub="Drag certificate text to reposition it. Fixed labels are not editable, and dynamic fields stay as placeholders."
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={!isDirty || saving}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!isDirty || saving}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saving ? (uploadingImage ? "Uploading…" : "Saving…") : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
        {/* Live preview */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Live Preview</p>
          {loading ? (
            <div className="flex aspect-[842/595] w-full animate-pulse items-center justify-center rounded-lg bg-muted text-muted-foreground text-sm">
              Loading…
            </div>
          ) : (
            <CertificatePreview
              data={PLACEHOLDER_DATA}
              overrides={overrides}
              previewMode
              editableLayout
              layoutPositions={layoutPositions}
              onLayoutPositionsChange={setLayoutPositions}
              className="w-full"
            />
          )}
          <p className="text-xs text-muted-foreground">
            Fields in brackets are dynamic — they change per certificate.
          </p>
        </div>

        {/* Edit form */}
        <div className="space-y-5 rounded-lg border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold">Editable Content</p>

          <div className="space-y-2">
            <Label htmlFor="bodyTemplate">Body Description</Label>
            <Textarea
              id="bodyTemplate"
              value={config.bodyTemplate ?? DEFAULT_BODY}
              onChange={(e) =>
                setConfig((c) => ({ ...c, bodyTemplate: e.target.value }))
              }
              rows={4}
              className="resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">
              The body paragraph shown on every certificate. Use <code>[ Exam Title ]</code>, <code>[ Score ]</code>, and <code>[ Date ]</code> as placeholders for dynamic values.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recipientNameFont">Recipient Name Font</Label>
              <select
                id="recipientNameFont"
                value={config.recipientNameFont}
                onChange={(e) => setConfig((c) => ({ ...c, recipientNameFont: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              >
                {RECIPIENT_FONT_OPTIONS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bodyFont">Description Font</Label>
              <select
                id="bodyFont"
                value={config.bodyFont}
                onChange={(e) => setConfig((c) => ({ ...c, bodyFont: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              >
                {BODY_FONT_OPTIONS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recipientNameAlign">Recipient Name Align</Label>
              <select
                id="recipientNameAlign"
                value={config.recipientNameAlign}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, recipientNameAlign: e.target.value as CertConfig["recipientNameAlign"] }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              >
                {ALIGN_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bodyAlign">Description Align</Label>
              <select
                id="bodyAlign"
                value={config.bodyAlign}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, bodyAlign: e.target.value as CertConfig["bodyAlign"] }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              >
                {ALIGN_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verifyBaseUrl">Verify URL Base</Label>
            <Input
              id="verifyBaseUrl"
              value={config.verifyBaseUrl}
              onChange={(e) => setConfig((c) => ({ ...c, verifyBaseUrl: e.target.value }))}
              placeholder="e.g. www.ventrix.global/certificate/"
            />
            <p className="text-xs text-muted-foreground">
              Credential ID is appended automatically: <code>{config.verifyBaseUrl}NX-XXXX</code>
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>New Template Upload</Label>
            <div
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-4 transition hover:border-primary/60 hover:bg-muted/40"
              onClick={() => fileRef.current?.click()}
            >
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {imageFile ? imageFile.name : "Click to upload a new certificate template PNG/JPG"}
              </p>
              {imageFile && (
                <p className="text-xs text-muted-foreground">
                  {(imageFile.size / 1024).toFixed(0)} KB
                </p>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
            <p className="text-xs text-muted-foreground">
              Recommended: 842 × 595 px (A4 landscape). Saving replaces the old certificate template.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
