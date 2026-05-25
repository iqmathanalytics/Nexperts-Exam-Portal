import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { setAuth, mapApiRole } from "@/lib/auth";

export const Route = createFileRoute("/verify-otp")({
  component: VerifyOTP,
  validateSearch: (s: Record<string, unknown>) => ({ email: (s.email as string) ?? "your email" }),
  head: () => ({ meta: [{ title: "Verify OTP — NExperts" }] }),
});

function VerifyOTP() {
  const { email } = Route.useSearch();
  const navigate = useNavigate();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(45);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const handleChange = (i: number, v: string) => {
    const ch = v.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[i] = ch;
    setOtp(next);
    if (ch && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.join("").length !== 6) return toast.error("Enter the 6-digit code");
    setLoading(true);
    try {
      const res = await api<{
        token: string;
        user: { id: string; email: string; fullName: string; role: string };
      }>("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, code: otp.join(""), purpose: "REGISTER" }),
      });
      setAuth({
        role: mapApiRole(res.user.role),
        email: res.user.email,
        token: res.token,
        userId: res.user.id,
        fullName: res.user.fullName,
      });
      toast.success("Email verified! Welcome to NExperts.");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      side="right"
      highlight={{
        title: "One last step to secure your account",
        sub: "We've sent a 6-digit verification code to your email.",
        bullets: ["Codes expire in 5 minutes", "Encrypted end-to-end", "Required for proctored exams"],
      }}
    >
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <MailCheck className="h-6 w-6" />
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Verify your email</h1>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code we sent to <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <div className="flex justify-center gap-2">
          {otp.map((v, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              value={v}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKey(i, e)}
              inputMode="numeric"
              maxLength={1}
              className="h-14 w-12 rounded-xl border border-input bg-card text-center font-display text-2xl font-bold outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          ))}
        </div>

        <Button type="submit" disabled={loading} className="w-full bg-gradient-emerald text-white shadow-glow">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Verify & Continue
        </Button>

        <div className="text-center text-sm">
          {seconds > 0 ? (
            <span className="text-muted-foreground">Resend code in <span className="font-mono">{seconds}s</span></span>
          ) : (
            <button type="button" onClick={() => { setSeconds(45); toast.success("New OTP sent"); }} className="text-accent hover:underline">
              Resend code
            </button>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Wrong email? <Link to="/register" className="text-accent hover:underline">Edit details</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
