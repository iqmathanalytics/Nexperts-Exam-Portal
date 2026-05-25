import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiAuth } from "@/lib/api-auth";
import { usePageDataLoad } from "@/contexts/page-load-context";
import { ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  usePageDataLoad(
    "admin-settings",
    async () => {
      const d = await apiAuth<{ user: { fullName: string; email: string } }>("/api/auth/me");
      setName(d.user.fullName);
      setEmail(d.user.email);
    },
    [],
  );

  const saveProfile = async () => {
    try {
      await apiAuth("/api/auth/me", { method: "PATCH", body: JSON.stringify({ fullName: name }) });
      toast.success("Profile saved");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Save failed");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" sub="Admin profile and platform configuration." />
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-4">
        <h3 className="font-display font-semibold">Profile</h3>
        <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label>Email</Label><Input value={email} disabled /></div>
        <Button onClick={saveProfile}>Save profile</Button>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-4">
        <h3 className="font-display font-semibold">Platform</h3>
        {[
          ["Email OTP for candidates", true],
          ["Stripe payments", true],
          ["AI proctoring default", true],
          ["Maintenance mode", false],
        ].map(([label, checked]) => (
          <div key={label as string} className="flex items-center justify-between">
            <span className="text-sm">{label as string}</span>
            <Switch defaultChecked={checked as boolean} />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Platform toggles are display-only until a settings table is added.</p>
      </div>
    </div>
  );
}
