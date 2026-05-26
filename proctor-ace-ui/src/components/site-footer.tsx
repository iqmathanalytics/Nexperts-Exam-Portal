import { Link } from "@tanstack/react-router";
import { ShieldCheck, Github, Twitter, Linkedin } from "lucide-react";
import { BRAND } from "@/lib/branding";

export function SiteFooter() {
  return (
    <footer id="contact" className="border-t border-border bg-sidebar text-sidebar-foreground">
      <div className="container mx-auto px-4 py-16 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-emerald">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <span className="font-display text-lg font-bold">{BRAND.shortName}<span className="text-accent">.</span></span>
            </Link>
            <p className="max-w-xs text-sm text-sidebar-foreground/70">
              The enterprise-grade AI-proctored certification platform trusted by thousands of professionals worldwide.
            </p>
            <div className="flex gap-3 pt-2">
              <a className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-accent/40 transition hover:bg-sidebar-accent" href="#"><Twitter className="h-4 w-4" /></a>
              <a className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-accent/40 transition hover:bg-sidebar-accent" href="#"><Linkedin className="h-4 w-4" /></a>
              <a className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-accent/40 transition hover:bg-sidebar-accent" href="#"><Github className="h-4 w-4" /></a>
            </div>
          </div>

          <FooterCol title="Platform" links={["Features", "AI Proctoring", "Certifications", "Pricing"]} />
          <FooterCol title="Company" links={["About", "Careers", "Contact", "Press"]} />
          <FooterCol title="Legal" links={["Privacy", "Terms", "Compliance", "Security"]} />
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-sidebar-border pt-6 text-xs text-sidebar-foreground/60 md:flex-row">
          <p>© {new Date().getFullYear()} {BRAND.copyright}. All rights reserved.</p>
          <p>ISO 27001 · SOC 2 Type II · GDPR compliant</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="mb-3 font-display text-sm font-semibold">{title}</h4>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l}><a href="#" className="text-sm text-sidebar-foreground/70 transition hover:text-sidebar-foreground">{l}</a></li>
        ))}
      </ul>
    </div>
  );
}
