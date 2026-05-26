import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, ShieldCheck, Eye, Cpu, Award, Sparkles, Clock, BarChart3,
  Camera, Lock, UserCheck, FileBadge, ChevronRight, Star, Check, Plus, Minus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { getAuth, type AuthSession } from "@/lib/auth";
import { BRAND } from "@/lib/branding";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const [auth, setAuth] = useState<AuthSession | null>(null);
  useEffect(() => setAuth(getAuth()), []);

  return (
    <div className="min-h-screen bg-background">
      <SiteNavbar />
      <Hero auth={auth} />
      <Marquee />
      <Features />
      <HowItWorks />
      <Proctoring />
      <Workflow />
      <Exams />
      <Testimonials />
      <FAQ />
      <CTA auth={auth} />
      <SiteFooter />
    </div>
  );
}

/* ------------------------------ HERO ------------------------------ */
function Hero({ auth }: { auth: AuthSession | null }) {
  const isCandidate = auth?.role === "candidate";
  const isAdmin = auth?.role === "admin";

  return (
    <section className="relative overflow-hidden bg-gradient-hero text-white">
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="absolute -top-32 right-0 h-[500px] w-[500px] rounded-full bg-accent/20 blur-3xl" />
      <div className="absolute -bottom-40 left-0 h-[500px] w-[500px] rounded-full bg-[oklch(0.5_0.18_260)]/30 blur-3xl" />

      <div className="container relative mx-auto px-4 py-24 lg:px-8 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="animate-fade-up">
            <Badge variant="outline" className="border-white/20 bg-white/5 text-white backdrop-blur">
              <Sparkles className="mr-1.5 h-3 w-3 text-gold" /> AI-Proctored · Enterprise grade
            </Badge>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight text-balance md:text-6xl lg:text-7xl">
              Certify your<br />
              <span className="bg-gradient-to-r from-accent via-[oklch(0.78_0.13_85)] to-accent bg-clip-text text-transparent">
                expertise
              </span>
              , globally.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/70 text-balance">
              {BRAND.name} is the secure exam management platform powering AI-proctored certifications,
              instant results, and verifiable credentials for the next generation of professionals.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isCandidate && (
                <>
                  <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
                    <Link to="/dashboard/my-exams">My Exams <ArrowRight className="ml-1 h-4 w-4" /></Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                    <Link to="/dashboard">Go to Dashboard</Link>
                  </Button>
                </>
              )}
              {isAdmin && (
                <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
                  <Link to="/admin">Admin Panel <ArrowRight className="ml-1 h-4 w-4" /></Link>
                </Button>
              )}
              {!auth && (
                <>
                  <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
                    <Link to="/register">Start Certification <ArrowRight className="ml-1 h-4 w-4" /></Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                    <a href="#exams">Browse exams</a>
                  </Button>
                </>
              )}
            </div>
            <div className="mt-10 flex gap-8 text-sm">
              <Stat n="120k+" l="Candidates certified" />
              <Stat n="98.7%" l="Proctor accuracy" />
              <Stat n="42" l="Countries" />
            </div>
          </div>

          <HeroCard />
        </div>
      </div>
    </section>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold text-white">{n}</div>
      <div className="text-xs text-white/60">{l}</div>
    </div>
  );
}

function HeroCard() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-3xl bg-gradient-emerald opacity-30 blur-2xl" />
      <div className="relative animate-float rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl shadow-elevated">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-success" />
            <span className="text-xs text-white/70">Live proctoring session</span>
          </div>
          <Badge className="bg-accent/20 text-accent border-0">Verified</Badge>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="aspect-video rounded-lg bg-gradient-to-br from-[oklch(0.3_0.08_240)] to-[oklch(0.2_0.06_260)] p-3">
            <Camera className="h-4 w-4 text-white/60" />
            <div className="mt-6 text-[10px] uppercase tracking-wider text-white/40">Webcam feed</div>
          </div>
          <div className="aspect-video rounded-lg bg-gradient-to-br from-[oklch(0.3_0.08_180)] to-[oklch(0.2_0.06_240)] p-3">
            <Eye className="h-4 w-4 text-accent" />
            <div className="mt-6 text-[10px] uppercase tracking-wider text-white/40">Gaze tracking</div>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Cloud Architect Professional</span>
            <span className="font-mono text-accent">01:24:08</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-2/3 bg-gradient-emerald" />
          </div>
          <div className="mt-3 flex justify-between text-[11px] text-white/50">
            <span>Question 54 / 80</span>
            <span>67% complete</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { i: ShieldCheck, l: "ID Verified" },
            { i: Lock, l: "Browser locked" },
            { i: Cpu, l: "AI active" },
          ].map(({ i: Icon, l }) => (
            <div key={l} className="rounded-md bg-white/5 p-2">
              <Icon className="mx-auto h-3.5 w-3.5 text-accent" />
              <div className="mt-1 text-[10px] text-white/60">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ MARQUEE ------------------------------ */
function Marquee() {
  const items = ["Microsoft", "Tata", "Infosys", "Deloitte", "Accenture", "Wipro", "IBM", "Capgemini"];
  return (
    <div className="border-y border-border bg-card/40 py-8">
      <div className="container mx-auto px-4 lg:px-8">
        <p className="mb-6 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Trusted by certification candidates from
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {items.map((b) => (
            <span key={b} className="font-display text-lg font-semibold text-muted-foreground/60 transition hover:text-foreground">
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ FEATURES ------------------------------ */
function Features() {
  const items = [
    { i: Eye, t: "AI Proctoring", d: "Computer vision + behavior analysis monitor every session in real time." },
    { i: ShieldCheck, t: "Secure Browser", d: "Locked exam environment prevents tab-switching, copy-paste, and screen capture." },
    { i: Cpu, t: "AI-Generated Exams", d: "Dynamic question pools and adaptive difficulty keep every exam unique." },
    { i: Award, t: "Verifiable Credentials", d: "Tamper-proof certificates with public verification URLs and QR codes." },
    { i: BarChart3, t: "Result Analytics", d: "Granular performance reports by topic, time, and difficulty." },
    { i: Clock, t: "Instant Results", d: "Auto-graded multiple-choice plus AI-assisted long-form scoring." },
  ];
  return (
    <section id="features" className="py-24">
      <div className="container mx-auto px-4 lg:px-8">
        <SectionHeading
          eyebrow="Platform"
          title="Built for the next era of certification"
          sub={`Every layer of ${BRAND.name} is engineered for trust — from candidate identity verification to credential issuance.`}
        />
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map(({ i: Icon, t, d }) => (
            <div key={t} className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-1 hover:border-accent/40 hover:shadow-elevated">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-emerald text-white shadow-glow">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              <div className="mt-4 flex items-center text-xs font-medium text-accent opacity-0 transition group-hover:opacity-100">
                Learn more <ChevronRight className="ml-1 h-3 w-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ HOW IT WORKS ------------------------------ */
function HowItWorks() {
  const steps = [
    { n: "01", t: "Register & verify", d: "Sign up with your details and verify your email via OTP." },
    { n: "02", t: "Choose an exam", d: "Browse certifications, apply vouchers, and securely purchase." },
    { n: "03", t: "Attend proctored exam", d: "Launch the locked browser — our AI monitors the session." },
    { n: "04", t: "Get certified", d: "View instant results and download your verified certificate." },
  ];
  return (
    <section className="bg-muted/40 py-24">
      <div className="container mx-auto px-4 lg:px-8">
        <SectionHeading eyebrow="How it works" title="Four steps to your credential" />
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.n} className="relative rounded-2xl border border-border bg-card p-6">
              <div className="font-display text-5xl font-bold text-accent/15">{s.n}</div>
              <h3 className="mt-2 font-display text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              {i < steps.length - 1 && (
                <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-accent/40 lg:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ PROCTORING ------------------------------ */
function Proctoring() {
  const points = [
    { i: UserCheck, t: "Identity verification", d: "Government ID + biometric face match before exam start." },
    { i: Eye, t: "Gaze & pose detection", d: "Detects looking away, multiple faces, and suspicious posture." },
    { i: Camera, t: "360° room scan", d: "Mandatory environment scan ensures a clean workspace." },
    { i: Cpu, t: "Real-time anomaly scoring", d: "Risk score updated continuously, reviewed by human moderators." },
  ];
  return (
    <section className="py-24">
      <div className="container mx-auto grid items-center gap-14 px-4 lg:grid-cols-2 lg:px-8">
        <div>
          <Badge variant="outline" className="border-accent/40 text-accent">AI Proctoring</Badge>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Cheating doesn't stand a chance.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Our hybrid AI + human review pipeline monitors every signal — visual, audio, behavioral —
            so your credentials carry real weight.
          </p>
          <div className="mt-8 space-y-5">
            {points.map(({ i: Icon, t, d }) => (
              <div key={t} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold">{t}</h4>
                  <p className="text-sm text-muted-foreground">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-3xl bg-gradient-emerald opacity-15 blur-3xl" />
          <div className="relative rounded-2xl border border-border bg-gradient-to-br from-sidebar to-[oklch(0.22_0.05_250)] p-6 text-white shadow-elevated">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-white/60">Session monitor</span>
              <Badge className="bg-success/20 text-success border-0">All clear</Badge>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-3 text-center">
              {[
                { l: "Identity", v: "✓" },
                { l: "Room", v: "✓" },
                { l: "Audio", v: "OK" },
                { l: "Risk", v: "0.04" },
              ].map((m) => (
                <div key={m.l} className="rounded-lg bg-white/5 p-3">
                  <div className="font-display text-xl font-bold text-accent">{m.v}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-white/50">{m.l}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-3">
              {[
                "Face match score 99.2%",
                "No additional voices detected",
                "Browser lock: active",
                "Gaze stability: 96%",
              ].map((line) => (
                <div key={line} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-success" /> <span className="text-white/80">{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ WORKFLOW ------------------------------ */
function Workflow() {
  const cats = ["AI & Machine Learning", "Cloud Computing", "Cybersecurity", "Data Engineering", "Project Management", "Full-Stack Development"];
  return (
    <section className="bg-muted/40 py-24">
      <div className="container mx-auto px-4 lg:px-8">
        <SectionHeading eyebrow="Certifications" title="Explore industry-recognised tracks" />
        <div className="mt-12 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {cats.map((c) => (
            <a href="#exams" key={c} className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 transition hover:border-accent/50 hover:shadow-soft">
              <div className="flex items-center gap-3">
                <FileBadge className="h-5 w-5 text-accent" />
                <span className="font-medium">{c}</span>
              </div>
              <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ EXAMS ------------------------------ */
type PublicExam = {
  id: string;
  title: string;
  category: string;
  description: string;
  duration: number;
  questions: number;
  price: number;
  difficulty?: string;
};

function Exams() {
  const [exams, setExams] = useState<PublicExam[]>([]);

  useEffect(() => {
    api<{ exams: PublicExam[] }>("/api/exams").then((d) => setExams(d.exams.slice(0, 6))).catch(() => {});
  }, []);

  return (
    <section id="exams" className="py-24">
      <div className="container mx-auto px-4 lg:px-8">
        <SectionHeading eyebrow="Featured exams" title="Certifications candidates love" />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {exams.map((e) => (
            <div key={e.id} className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-elevated">
              <div className="flex items-start justify-between gap-2">
                <Badge variant="secondary" className="text-xs">{e.category}</Badge>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold leading-snug">{e.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                <Meta l="Duration" v={`${e.duration}m`} />
                <Meta l="Questions" v={e.questions} />
                <Meta l="Level" v={e.difficulty ?? "Intermediate"} />
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
                <span className="font-display text-2xl font-bold">MYR {e.price}</span>
                <Button asChild size="sm" variant="outline" className="group-hover:border-accent group-hover:text-accent">
                  <Link to="/register">Enroll <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Meta({ l, v }: { l: string; v: string | number }) {
  return (
    <div className="rounded-lg bg-muted/60 py-2">
      <div className="font-semibold">{v}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{l}</div>
    </div>
  );
}

/* ------------------------------ TESTIMONIALS ------------------------------ */
function Testimonials() {
  const items = [
    { n: "Priya Menon", r: "ML Engineer, Bengaluru", q: "The proctoring was seamless and the certificate has genuine recognition in interviews." },
    { n: "Daniel Okoro", r: "Cloud Consultant, Lagos", q: "Honestly the smoothest enterprise exam experience I've had. Result was instant." },
    { n: "Sofia Marín", r: "Security Analyst, Madrid", q: `${BRAND.name} feels like the AWS of certifications — polished, secure, and trusted.` },
  ];
  return (
    <section className="bg-gradient-hero py-24 text-white">
      <div className="container mx-auto px-4 lg:px-8">
        <SectionHeading eyebrow="Testimonials" title="Loved by certified professionals" dark />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {items.map((t) => (
            <div key={t.n} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex gap-0.5 text-gold">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="mt-4 text-white/85">"{t.q}"</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-emerald font-display font-bold">
                  {t.n[0]}
                </div>
                <div>
                  <div className="text-sm font-semibold">{t.n}</div>
                  <div className="text-xs text-white/60">{t.r}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ FAQ ------------------------------ */
function FAQ() {
  const items = [
    { q: "How does AI proctoring work?", a: "Our system combines computer vision, audio analysis, and behavior tracking to monitor exam sessions in real time. Anomalies are flagged for human moderator review." },
    { q: "Can I retake an exam?", a: "Each exam includes 2–3 attempts depending on the certification. Vouchers may grant additional attempts." },
    { q: `Are ${BRAND.name} certificates recognised?`, a: "Yes — our credentials follow Open Badges 2.0 standards and include public verification URLs and QR codes." },
    { q: "What hardware do I need?", a: "A laptop or desktop with a working webcam, microphone, stable internet, and a supported modern browser." },
    { q: "Do you support vouchers and group purchases?", a: "Absolutely. Voucher codes can be applied at checkout, and enterprise plans support bulk purchases." },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="py-24">
      <div className="container mx-auto max-w-3xl px-4 lg:px-8">
        <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
        <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
          {items.map((item, i) => (
            <button key={i} onClick={() => setOpen(open === i ? null : i)} className="w-full px-6 py-5 text-left">
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium">{item.q}</span>
                {open === i ? <Minus className="h-4 w-4 text-accent" /> : <Plus className="h-4 w-4 text-muted-foreground" />}
              </div>
              {open === i && <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ CTA ------------------------------ */
function CTA({ auth }: { auth: AuthSession | null }) {
  if (auth) return null;

  return (
    <section className="px-4 pb-24 lg:px-8">
      <div className="container mx-auto overflow-hidden rounded-3xl bg-gradient-emerald p-12 text-white shadow-elevated md:p-16">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <h3 className="font-display text-3xl font-bold md:text-4xl">Ready to certify your expertise?</h3>
            <p className="mt-2 text-white/85">Join 120,000+ professionals already credentialed on {BRAND.name}.</p>
          </div>
          <div className="flex gap-3">
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
              <Link to="/register">Get Started</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, sub, dark }: { eyebrow: string; title: string; sub?: string; dark?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className={`mb-3 text-xs font-semibold uppercase tracking-[0.2em] ${dark ? "text-accent" : "text-accent"}`}>{eyebrow}</div>
      <h2 className={`font-display text-3xl font-bold tracking-tight md:text-5xl text-balance ${dark ? "text-white" : ""}`}>{title}</h2>
      {sub && <p className={`mt-4 ${dark ? "text-white/70" : "text-muted-foreground"}`}>{sub}</p>}
    </div>
  );
}
