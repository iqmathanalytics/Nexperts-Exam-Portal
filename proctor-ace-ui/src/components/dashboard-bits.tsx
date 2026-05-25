import { cn } from "@/lib/utils";

export function StatCard({
  label, value, hint, icon: Icon, accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "emerald" | "gold" | "blue" | "rose";
}) {
  const map = {
    emerald: "bg-accent/10 text-accent",
    gold: "bg-gold/15 text-gold-foreground",
    blue: "bg-chart-1/15 text-chart-1",
    rose: "bg-destructive/10 text-destructive",
  } as const;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 font-display text-3xl font-bold">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", map[accent ?? "emerald"])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon, title, sub, action,
}: { icon: React.ComponentType<{ className?: string }>; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      {sub && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
