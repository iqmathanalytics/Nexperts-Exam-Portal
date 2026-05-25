import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Fingerprint, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { getAuth, setAuth, mapApiRole } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/admin-login")({
  beforeLoad: () => {
    const auth = getAuth();
    if (auth?.role === "admin") throw redirect({ to: "/admin" });
    if (auth?.role === "candidate") throw redirect({ to: "/dashboard" });
  },
  component: AdminLogin,
  head: () => ({ meta: [{ title: "Admin Portal — NExperts" }] }),
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Enter credentials");
    setLoading(true);
    try {
      const res = await api<{
        token: string;
        user: { id: string; email: string; fullName: string; role: string };
      }>("/api/auth/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAuth({
        role: mapApiRole(res.user.role),
        email: res.user.email,
        token: res.token,
        userId: res.user.id,
        fullName: res.user.fullName,
      });
      toast.success("Welcome, Admin");
      navigate({ to: "/admin" });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-sidebar text-sidebar-foreground">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-accent/15 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-[500px] w-[500px] rounded-full bg-[oklch(0.4_0.18_280)]/20 blur-3xl" />

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md px-6">
        <div className="mb-8 flex justify-center">
          <BrandLogo to="/" imgClassName="h-12" />
        </div>

        <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/30 p-8 backdrop-blur-xl shadow-elevated">
          <div className="mb-6 flex items-center justify-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Lock className="h-4 w-4" />
            </div>
            <div className="text-xs uppercase tracking-[0.2em] text-sidebar-foreground/70">Admin Portal</div>
          </div>
          <h1 className="text-center font-display text-3xl font-bold tracking-tight">Secure sign in</h1>
          <p className="mt-1 text-center text-sm text-sidebar-foreground/70">
            Authorised personnel only. All access is logged.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@nexperts.io"
                className="border-sidebar-border bg-sidebar/50 text-sidebar-foreground placeholder:text-sidebar-foreground/40"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Password</Label>
                <a href="#" className="text-[11px] text-accent hover:underline">Forgot?</a>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="border-sidebar-border bg-sidebar/50 text-sidebar-foreground placeholder:text-sidebar-foreground/40"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-gradient-emerald text-white shadow-glow">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Fingerprint className="mr-2 h-4 w-4" />}
              Sign in securely
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-sidebar-foreground/50">
            <ShieldCheck className="h-3 w-3" /> 256-bit TLS · MFA · Audit logged
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-sidebar-foreground/50">
          Not an admin? <Link to="/login" className="text-accent hover:underline">User login</Link>
        </p>
      </div>
    </div>
  );
}
