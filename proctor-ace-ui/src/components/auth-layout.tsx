import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthLayout({
  side = "right",
  highlight,
  children,
}: {
  side?: "left" | "right";
  highlight: { title: string; sub: string; bullets: string[] };
  children: React.ReactNode;
}) {
  const panel = (
    <div className="relative hidden overflow-hidden bg-gradient-hero p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute inset-0 grid-bg opacity-50" />
      <div className="absolute -bottom-32 -left-20 h-[400px] w-[400px] rounded-full bg-accent/30 blur-3xl" />

      <BrandLogo to="/" className="relative" imgClassName="h-10" />

      <div className="relative">
        <h2 className="font-display text-4xl font-bold leading-tight text-balance">{highlight.title}</h2>
        <p className="mt-3 text-white/70">{highlight.sub}</p>
        <ul className="mt-8 space-y-3">
          {highlight.bullets.map((b) => (
            <li key={b} className="flex items-center gap-3 text-sm text-white/85">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {b}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-white/40">© {new Date().getFullYear()} NExperts Certification Portal</p>
    </div>
  );

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {side === "left" ? panel : null}
      <div className="relative flex items-center justify-center bg-background p-6">
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <ThemeToggle />
          <Link to="/" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Home
          </Link>
        </div>
        <div className="w-full max-w-md">{children}</div>
      </div>
      {side === "right" ? panel : null}
    </div>
  );
}
