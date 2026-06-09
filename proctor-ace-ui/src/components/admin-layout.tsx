import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutOutlet } from "@/components/layout-outlet";
import { PageLoadProvider } from "@/contexts/page-load-context";
import { AdminSearchProvider, useAdminSearch } from "@/contexts/admin-search-context";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, BookOpen, HelpCircle, Sparkles, Users, CreditCard, Ticket,
  Monitor, BarChart3, Award, FileText, Settings, LogOut, Bell, Search, ChevronDown, Link2,
  AlertCircle, Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/brand-logo";
import { clearAuth, getAuth } from "@/lib/auth";
import { apiAuth } from "@/lib/api-auth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const nav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/exams", label: "Exam Management", icon: BookOpen },
  { to: "/admin/questions", label: "Question Bank", icon: HelpCircle },
  { to: "/admin/ai-generator", label: "AI Generator", icon: Sparkles },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/vouchers", label: "Vouchers", icon: Ticket },
  { to: "/admin/question-pools", label: "Question Pools", icon: Link2 },
  { to: "/admin/monitoring", label: "Exam Monitoring", icon: Monitor },
  { to: "/admin/results", label: "Results", icon: BarChart3 },
  { to: "/admin/certificates", label: "Certificates", icon: Award },
  { to: "/admin/reports", label: "Reports", icon: FileText },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

function AdminNotifications() {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = () => {
    apiAuth<{ notifications: AdminNotification[]; unreadCount: number }>("/api/admin/notifications")
      .then((d) => {
        setItems(d.notifications);
        setUnread(d.unreadCount);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const markRead = () => {
    if (unread === 0) return;
    apiAuth("/api/admin/notifications/mark-read", { method: "POST" })
      .then(() => {
        setUnread(0);
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      })
      .catch(() => {});
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) markRead();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <div className="font-display font-semibold">Admin Notifications</div>
          {unread > 0 && (
            <p className="text-xs text-muted-foreground">{unread} unread</p>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            items.map((n) => (
              <div key={n.id} className="border-b border-border/60 px-4 py-3 last:border-0">
                <div className="flex items-start gap-2">
                  {n.type === "alert" ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{n.title}</span>
                      {!n.read && (
                        <Badge variant="destructive" className="h-4 px-1 text-[9px]">New</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AdminHeaderSearch() {
  const { query, setQuery, clearQuery } = useAdminSearch();

  return (
    <div className="relative hidden min-w-0 flex-1 max-w-[11rem] sm:block sm:max-w-xs md:max-w-80">
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
    <div className="mobile-shell flex min-h-screen w-full bg-muted/30">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground xl:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
          <BrandLogo to="/admin" variant="sidebar" showText={false} />
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden px-3 py-2">
          {nav.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? path === to : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to as "/admin"}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium leading-snug transition ${
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

        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-accent/40 p-2.5">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-[oklch(0.45_0.15_25)] text-xs text-white" suppressHydrationWarning>{initials}</AvatarFallback>
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

      <main className="flex min-w-0 w-full max-w-full flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 min-w-0 w-full max-w-full items-center gap-2 overflow-hidden border-b border-border bg-background/85 px-3 backdrop-blur-xl sm:gap-3 sm:px-4 lg:px-8">
          <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
            <span>Admin</span>
            <ChevronDown className="h-3 w-3" />
            <span className="font-medium text-foreground">{current?.label ?? "Dashboard"}</span>
          </div>
          <AdminHeaderSearch />
          <AdminNotifications />
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

        <div className="min-w-0 max-w-full flex-1 overflow-x-clip p-4 lg:p-8">
          <LayoutOutlet />
        </div>
      </main>
    </div>
    </AdminSearchProvider>
    </PageLoadProvider>
  );
}
