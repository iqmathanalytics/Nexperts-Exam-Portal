import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutOutlet } from "@/components/layout-outlet";
import { PageLoadProvider } from "@/contexts/page-load-context";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, BookOpen, ClipboardList, CreditCard, Award, History,
  UserCog, LogOut, Search, ChevronDown,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { clearAuth, getAuth } from "@/lib/auth";
import { apiAuth } from "@/lib/api-auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserNotifications } from "@/components/user-notifications";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const nav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/exams", label: "Available Exams", icon: BookOpen },
  { to: "/dashboard/my-exams", label: "My Exams", icon: ClipboardList },
  { to: "/dashboard/payments", label: "Payments", icon: CreditCard },
  { to: "/dashboard/certificates", label: "Certificates", icon: Award },
  { to: "/dashboard/history", label: "Exam History", icon: History },
  { to: "/dashboard/profile", label: "Profile Settings", icon: UserCog },
];

function initialsFrom(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "··";
}

export function DashboardLayout() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isExamRoute = /\/dashboard\/exam\//.test(path);

  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    setMounted(true);
    const auth = getAuth();
    setName(auth?.fullName ?? "Candidate");
    setEmail(auth?.email ?? "");
    apiAuth<{ user: { fullName: string; email: string } }>("/api/auth/me")
      .then((d) => {
        setName(d.user.fullName);
        setEmail(d.user.email);
      })
      .catch(() => {});
  }, []);

  const logout = () => {
    clearAuth();
    toast.success("Signed out");
    navigate({ to: "/" });
  };

  const current = nav.find((n) => (n.exact ? path === n.to : path.startsWith(n.to)));
  const initials = mounted ? initialsFrom(name) : "··";
  const displayName = mounted ? name || "Candidate" : "";

  if (isExamRoute) {
    return (
      <PageLoadProvider>
        <LayoutOutlet />
      </PageLoadProvider>
    );
  }

  return (
    <PageLoadProvider>
    <div className="flex min-h-screen bg-muted/30">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <BrandLogo to="/dashboard" variant="sidebar" showText={false} />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <div className="px-3 pb-2 pt-3 text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/40">
            Workspace
          </div>
          {nav.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? path === to : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to as "/dashboard"}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-glow"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/40 p-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-gradient-emerald text-white" suppressHydrationWarning>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium" suppressHydrationWarning>{displayName}</div>
              <div className="truncate text-[11px] text-sidebar-foreground/60" suppressHydrationWarning>{email}</div>
            </div>
            <button onClick={logout} className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar/40 hover:text-sidebar-foreground" aria-label="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl lg:px-8">
          <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
            <span>Workspace</span>
            <ChevronDown className="h-3 w-3" />
            <span className="font-medium text-foreground">{current?.label ?? "Dashboard"}</span>
          </div>
          <div className="relative ml-auto hidden md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search exams, certificates..." className="w-72 pl-9" />
          </div>
          <UserNotifications />
          <ThemeToggle />
          <div className="lg:hidden">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-emerald text-white text-xs" suppressHydrationWarning>
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-8">
          <LayoutOutlet />
        </div>

        <nav className="sticky bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur lg:hidden">
          {nav.slice(0, 5).map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? path === to : path.startsWith(to);
            return (
              <Link key={to} to={to as "/dashboard"} className={`flex flex-col items-center gap-1 py-2.5 text-[10px] ${active ? "text-accent" : "text-muted-foreground"}`}>
                <Icon className="h-4 w-4" />
                <span className="truncate">{label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
    </PageLoadProvider>
  );
}
