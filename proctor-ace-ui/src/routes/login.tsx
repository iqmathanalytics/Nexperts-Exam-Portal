import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { api, ApiError } from "@/lib/api-client";
import { getAuth, setAuth, mapApiRole } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    const auth = getAuth();
    if (auth?.role === "candidate") throw redirect({ to: "/dashboard" });
    if (auth?.role === "admin") throw redirect({ to: "/admin" });
  },
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — NExperts" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid email");
    setLoading(true);
    try {
      await api("/api/auth/login/send-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setStep("otp");
      toast.success("OTP sent to your email");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return toast.error("Enter the 6-digit OTP");
    setLoading(true);
    try {
      const res = await api<{
        token: string;
        user: { id: string; email: string; fullName: string; role: string };
      }>("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, code: otp, purpose: "LOGIN" }),
      });
      setAuth({
        role: mapApiRole(res.user.role),
        email: res.user.email,
        token: res.token,
        userId: res.user.id,
        fullName: res.user.fullName,
      });
      toast.success("Welcome back!");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      side="left"
      highlight={{
        title: "Welcome back, certified expert.",
        sub: "Securely access your proctored exams, results, and credentials.",
        bullets: ["Passwordless email OTP", "Trusted device recognition", "Enterprise-grade encryption"],
      }}
    >
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          New here? <Link to="/register" className="text-accent hover:underline">Create an account</Link>
        </p>
      </div>

      {step === "email" ? (
        <form onSubmit={sendOtp} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
            <span className="text-muted-foreground">Remember this device for 30 days</span>
          </label>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-emerald text-white shadow-glow">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send login code
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Admin?{" "}
            <Link to="/admin-login" className="text-accent hover:underline">Use admin portal</Link>
          </p>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">6-digit code sent to {email}</Label>
            <Input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="text-center font-mono text-lg tracking-[0.4em]"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-emerald text-white shadow-glow">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verify & Sign in
          </Button>
          <button type="button" onClick={() => setStep("email")} className="block w-full text-center text-xs text-muted-foreground hover:text-foreground">
            ← Use a different email
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
