import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutOutlet } from "@/components/layout-outlet";
import { PageLoadProvider } from "@/contexts/page-load-context";
import { AdminSearchProvider, useAdminSearch } from "@/contexts/admin-search-context";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, BookOpen, HelpCircle, Sparkles, Users, CreditCard, Ticket,
  Monitor, BarChart3, Award, FileText, Settings, LogOut, Bell, Search, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/brand-logo";
import { clearAuth, getAuth } from "@/lib/auth";
import { apiAuth } from "@/lib/api-auth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const nav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/exams", label: "Exam Management", icon: BookOpen },
  { to: "/admin/questions", label: "Question Bank", icon: HelpCircle },
  { to: "/admin/ai-generator", label: "AI Generator", icon: Sparkles },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/vouchers", label: "Vouchers", icon: Ticket },
  { to: "/admin/monitoring", label: "Exam Monitoring", icon: Monitor },
  { to: "/admin/results", label: "Results", icon: BarChart3 },
  { to: "/admin/certificates", label: "Certificates", icon: Award },
  { to: "/admin/reports", label: "Reports", icon: FileText },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminHeaderSearch() {
  const { query, setQuery, clearQuery } = useAdminSearch();

  return (
    <div className="relative ml-auto min-w-0 flex-1 max-w-[11rem] sm:max-w-xs md:max-w-80">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search users, exams, questions, vouchers..."
        className="w-full pl-9 pr-9"
        aria-label="Search admin data"
      />
      {query && (
        <button
          type="button"
          onClick={clearQuery}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          Clear
        </button>
      )}
    </div>
  );
}

export function AdminLayout() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    setMounted(true);
    const auth = getAuth();
    setName(auth?.fullName ?? auth?.email ?? "Admin");
    apiAuth<{ user: { fullName: string } }>("/api/auth/me")
      .then((d) => setName(d.user.fullName))
      .catch(() => {});
  }, []);

  const logout = () => {
    clearAuth();
    toast.success("Admin signed out");
    navigate({ to: "/admin-login" });
  };

  const current = nav.find((n) => (n.exact ? path === n.to : path.startsWith(n.to)));
  const initials = mounted
    ? name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "··"
    : "··";

  return (
    <PageLoadProvider>
    <AdminSearchProvider>
    <div className="flex min-h-screen bg-muted/30">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground xl:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <BrandLogo to="/admin" variant="sidebar" showText={false} />
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          <div className="px-3 pb-2 pt-2 text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/40">
            Admin Console
          </div>
          {nav.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? path === to : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to as "/admin"}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-glow"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/40 p-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-[oklch(0.45_0.15_25)] text-white" suppressHydrationWarning>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{name}</div>
              <div className="truncate text-[11px] text-sidebar-foreground/60">Administrator</div>
            </div>
            <button onClick={logout} className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar/40" aria-label="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl lg:px-8">
          <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
            <span>Admin</span>
            <ChevronDown className="h-3 w-3" />
            <span className="font-medium text-foreground">{current?.label ?? "Dashboard"}</span>
          </div>
          <AdminHeaderSearch />
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-[oklch(0.45_0.15_25)] text-xs text-white">{initials}</AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/admin/settings">Profile & settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <div className="flex-1 p-4 lg:p-8">
          <LayoutOutlet />
        </div>
      </main>
    </div>
    </AdminSearchProvider>
    </PageLoadProvider>
  );
}
