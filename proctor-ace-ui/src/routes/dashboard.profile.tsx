import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Camera, Save } from "lucide-react";
import { PageHeader } from "@/components/dashboard-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { apiAuth } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-client";
import { usePageDataLoad } from "@/contexts/page-load-context";

type ProfileForm = {
  name: string;
  email: string;
  phone: string;
  icPassport: string;
  degree: string;
  dob: string;
  joined: string;
};

export const Route = createFileRoute("/dashboard/profile")({
  component: Profile,
});

function Profile() {
  const [form, setForm] = useState<ProfileForm | null>(null);

  usePageDataLoad(
    "profile",
    async () => {
      const d = await apiAuth<{ user: { fullName: string; email: string; phone: string | null; icPassport: string | null; degree: string | null; dob: Date | null; createdAt: string } }>(
        "/api/auth/me",
      );
      const u = d.user;
      setForm({
        name: u.fullName,
        email: u.email,
        phone: u.phone ?? "",
        icPassport: u.icPassport ?? "",
        degree: u.degree ?? "",
        dob: u.dob ? new Date(u.dob).toISOString().slice(0, 10) : "",
        joined: u.createdAt,
      });
    },
    [],
  );

  if (!form) return null;

  const update = (k: keyof ProfileForm, v: string) => setForm({ ...form, [k]: v });

  const save = async () => {
    try {
      await apiAuth("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: form.name,
          phone: form.phone,
          icPassport: form.icPassport,
          degree: form.degree,
          dob: form.dob || undefined,
        }),
      });
      toast.success("Profile saved");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Save failed");
    }
  };

  return (
    <>
      <PageHeader title="Profile Settings" sub="Manage your account information and security preferences." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="bg-gradient-emerald text-2xl font-display text-white">
                  {form.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </AvatarFallback>
              </Avatar>
              <button className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-4 border-card bg-accent text-white">
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold">{form.name}</h3>
            <p className="text-sm text-muted-foreground">{form.email}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Member since {new Date(form.joined).toLocaleDateString("en", { month: "short", year: "numeric" })}
            </p>
          </div>

          <div className="mt-6 space-y-3 border-t border-border pt-6">
            <Pref label="Email notifications" defaultChecked />
            <Pref label="Exam reminders" defaultChecked />
            <Pref label="Marketing emails" />
            <Pref label="Remember device" defaultChecked />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h3 className="font-display text-lg font-semibold">Personal information</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" v={form.name} onChange={(v) => update("name", v)} />
              <Field label="Email" v={form.email} onChange={() => {}} disabled />
              <Field label="Phone" v={form.phone} onChange={(v) => update("phone", v)} />
              <Field label="IC / Passport" v={form.icPassport} onChange={(v) => update("icPassport", v)} />
              <Field label="Degree" v={form.degree} onChange={(v) => update("degree", v)} />
              <Field label="Date of birth" v={form.dob} onChange={(v) => update("dob", v)} type="date" />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button onClick={save} className="bg-gradient-emerald text-white">
                <Save className="mr-2 h-4 w-4" /> Save changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, v, onChange, type, disabled }: { label: string; v: string; onChange: (v: string) => void; type?: string; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={v} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

function Pref({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <Switch defaultChecked={defaultChecked} />
    </label>
  );
}
