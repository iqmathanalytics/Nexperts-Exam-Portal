import { cn } from "@/lib/utils";
import { StatCard, PageHeader } from "@/components/dashboard-bits";

export { StatCard, PageHeader };

export function StatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
    Published: "bg-success/15 text-success",
    PUBLISHED: "bg-success/15 text-success",
    Draft: "bg-muted text-muted-foreground",
    DRAFT: "bg-muted text-muted-foreground",
    Archived: "bg-muted text-muted-foreground",
    ARCHIVED: "bg-muted text-muted-foreground",
    Active: "bg-success/15 text-success",
    ACTIVE: "bg-success/15 text-success",
    Suspended: "bg-destructive/10 text-destructive",
    SUSPENDED: "bg-destructive/10 text-destructive",
    Paid: "bg-success/15 text-success",
    PAID: "bg-success/15 text-success",
    Pending: "bg-warning/15 text-warning-foreground",
    PENDING: "bg-warning/15 text-warning-foreground",
    Refunded: "bg-muted text-muted-foreground",
    REFUNDED: "bg-muted text-muted-foreground",
    Pass: "bg-success/15 text-success",
    Fail: "bg-destructive/10 text-destructive",
    "In Progress": "bg-chart-1/15 text-chart-1",
    Flagged: "bg-destructive/10 text-destructive",
    Completed: "bg-muted text-muted-foreground",
    Warning: "bg-warning/15 text-warning-foreground",
    Critical: "bg-destructive/10 text-destructive",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", styles[status] ?? "bg-muted")}>
      {status}
    </span>
  );
}

export function DataToolbar({
  search,
  onSearch,
  placeholder = "Search...",
  action,
  hideInput,
}: {
  search: string;
  onSearch: (v: string) => void;
  placeholder?: string;
  action?: React.ReactNode;
  /** Hide duplicate input when using the header global search */
  hideInput?: boolean;
}) {
  if (hideInput && !action) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {!hideInput && (
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="h-10 min-w-[200px] flex-1 rounded-lg border border-input bg-background px-3 text-sm md:max-w-sm"
        />
      )}
      {hideInput && search && (
        <p className="text-sm text-muted-foreground">
          Filtering by: <span className="font-medium text-foreground">&quot;{search}&quot;</span>
        </p>
      )}
      {action}
    </div>
  );
}
