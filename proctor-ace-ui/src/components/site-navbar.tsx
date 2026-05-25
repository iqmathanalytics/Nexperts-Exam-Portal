import { Link } from "@tanstack/react-router";
import { Menu, X, LayoutDashboard, Shield } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAuth, type AuthSession } from "@/lib/auth";

const nav = [
  { label: "Home", to: "/" as const, hash: "" },
  { label: "Features", to: "/" as const, hash: "#features" },
  { label: "Exams", to: "/" as const, hash: "#exams" },
  { label: "Contact", to: "/" as const, hash: "#contact" },
];

export function SiteNavbar() {
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState<AuthSession | null>(null);

  useEffect(() => {
    setAuth(getAuth());
  }, []);

  const isCandidate = auth?.role === "candidate";
  const isAdmin = auth?.role === "admin";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
        <BrandLogo to={isAdmin ? "/admin" : isCandidate ? "/dashboard" : "/"} />

        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <a key={n.label} href={n.hash || "/"} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {isCandidate && (
            <Button asChild size="sm" className="bg-gradient-emerald text-white shadow-glow hover:opacity-95">
              <Link to="/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard</Link>
            </Button>
          )}
          {isAdmin && (
            <Button asChild size="sm" variant="outline">
              <Link to="/admin"><Shield className="mr-2 h-4 w-4" /> Admin panel</Link>
            </Button>
          )}
          {!auth && (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin-login">Admin Login</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/login">User Login</Link>
              </Button>
              <Button asChild size="sm" className="bg-gradient-emerald text-white shadow-glow hover:opacity-95">
                <Link to="/register">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="container mx-auto flex flex-col gap-2 px-4 py-4">
            {nav.map((n) => (
              <a key={n.label} href={n.hash || "/"} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-muted">
                {n.label}
              </a>
            ))}
            {isCandidate && (
              <Button asChild size="sm" className="mt-2 bg-gradient-emerald text-white">
                <Link to="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
              </Button>
            )}
            {isAdmin && (
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link to="/admin" onClick={() => setOpen(false)}>Admin panel</Link>
              </Button>
            )}
            {!auth && (
              <>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button asChild variant="outline" size="sm"><Link to="/login">User Login</Link></Button>
                  <Button asChild variant="ghost" size="sm"><Link to="/admin-login">Admin Login</Link></Button>
                </div>
                <Button asChild size="sm" className="bg-gradient-emerald text-white"><Link to="/register">Get Started</Link></Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
