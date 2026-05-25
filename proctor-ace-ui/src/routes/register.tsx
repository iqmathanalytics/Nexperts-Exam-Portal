import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/register")({
  component: Register,
  head: () => ({ meta: [{ title: "Create your account — NExperts" }] }),
});

function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", icPassport: "", mycat: "", degree: "", dob: "", password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.fullName) next.fullName = "Required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Valid email required";
    if (form.phone.length < 6) next.phone = "Required";
    if (!form.icPassport) next.icPassport = "Required";
    if (!form.mycat) next.mycat = "Required";
    if (!form.password || form.password.length < 6) next.password = "Min 6 characters";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          icPassport: form.icPassport,
          mycat: form.mycat,
          degree: form.degree || undefined,
          dob: form.dob || undefined,
          password: form.password,
        }),
      });
      toast.success("OTP sent to your email");
      navigate({ to: "/verify-otp", search: { email: form.email } });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      side="left"
      highlight={{
        title: "Create your NExperts candidate account",
        sub: "Secure registration with email OTP verification.",
        bullets: ["AI-proctored certification access", "Verifiable digital credentials", "Track results, payments and certificates"],
      }}
    >
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">Create account</h1>
        <p className="text-sm text-muted-foreground">
          Already registered?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">Sign in</Link>
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Full name" error={errors.fullName}>
          <Input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Aarav Sharma" />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@company.com" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" error={errors.phone}>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+60 12-345 6789" />
          </Field>
          <Field label="IC / Passport" error={errors.icPassport}>
            <Input value={form.icPassport} onChange={(e) => update("icPassport", e.target.value)} placeholder="901234-10-5678" />
          </Field>
        </div>
        <Field label="MyCAT Number" error={errors.mycat}>
          <Input value={form.mycat} onChange={(e) => update("mycat", e.target.value)} placeholder="MYCAT-XXXX" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Degree">
            <Input value={form.degree} onChange={(e) => update("degree", e.target.value)} placeholder="B.Tech, CS" />
          </Field>
          <Field label="Date of birth">
            <Input type="date" value={form.dob} onChange={(e) => update("dob", e.target.value)} />
          </Field>
        </div>
        <Field label="Password" error={errors.password} hint="For future use">
          <Input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="••••••••" />
        </Field>

        <Button type="submit" disabled={loading} className="w-full bg-gradient-emerald text-white shadow-glow">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Send OTP
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our <a href="#" className="underline">Terms</a> and <a href="#" className="underline">Privacy</a>.
        </p>
      </form>
    </AuthLayout>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
