import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, BarChart3, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { downloadAuthCsv } from "@/lib/api-auth";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
});

const reports = [
  { title: "Revenue report", type: "revenue", desc: "Monthly revenue, refunds, and Stripe settlements", icon: BarChart3 },
  { title: "Candidate performance", type: "results", desc: "Scores, pass rates, and attempt history", icon: Users },
  { title: "User directory", type: "users", desc: "All registered candidates and account status", icon: FileSpreadsheet },
  { title: "Violation report", type: "violations", desc: "Proctoring flags and warning summaries", icon: AlertTriangle },
];

function AdminReports() {
  const exportCsv = async (type: string, title: string) => {
    try {
      await downloadAuthCsv(`/api/admin/reports/${type}`, `${type}-report.csv`);
      toast.success(`${title} exported`);
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" sub="Export analytics to CSV from live database records." />
      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((r) => (
          <div key={r.title} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <r.icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold">{r.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
              <Button className="mt-4" variant="outline" size="sm" onClick={() => exportCsv(r.type, r.title)}>
                <Download className="mr-2 h-4 w-4" />Export CSV
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
