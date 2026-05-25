import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  BookOpen, Award, Clock, TrendingUp, ArrowRight, CheckCircle2, XCircle, Sparkles,
} from "lucide-react";
import { StatCard } from "@/components/dashboard-bits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiAuth } from "@/lib/api-auth";
import { formatAttemptDateTime } from "@/lib/format-datetime";
import { usePageDataLoad } from "@/contexts/page-load-context";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const [data, setData] = useState<{
    user: { name: string } | null;
    stats: { examsPurchased: number; certificates: number; passRate: string };
    recentAttempts: { id: string; examTitle: string; startedAt: string; score: number; result: string }[];
  } | null>(null);

  usePageDataLoad(
    "dashboard-home",
    async () => {
      const d = await apiAuth<NonNullable<typeof data>>("/api/candidate/dashboard");
      setData(d);
    },
    [],
  );

  const name = data?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 text-white shadow-elevated">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge variant="outline" className="border-white/20 bg-white/10 text-white">
              <Sparkles className="mr-1 h-3 w-3 text-gold" /> Welcome back
            </Badge>
            <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">Hello, {name} 👋</h2>
            <p className="mt-2 max-w-lg text-white/75">
              {data
                ? `${data.stats.examsPurchased} exams purchased · ${data.stats.certificates} certificates`
                : "Loading your dashboard…"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild className="bg-white text-primary hover:bg-white/90">
              <Link to="/dashboard/exams">Browse exams</Link>
            </Button>
            <Button asChild variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white">
              <Link to="/dashboard/certificates">My certificates</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Exams Purchased" value={data?.stats.examsPurchased ?? "—"} icon={BookOpen} />
        <StatCard label="Certificates" value={data?.stats.certificates ?? "—"} icon={Award} accent="gold" />
        <StatCard label="Pass Rate" value={data?.stats.passRate ?? "—"} icon={TrendingUp} accent="emerald" />
        <StatCard label="Recent" value={data?.recentAttempts?.length ?? 0} hint="Attempts logged" icon={Clock} accent="blue" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h3 className="font-display text-lg font-semibold">Recent activity</h3>
        <div className="mt-4 space-y-4">
          {(data?.recentAttempts ?? []).map((a) => (
            <div key={a.id} className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${a.result === "Pass" ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"}`}>
                {a.result === "Pass" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{a.examTitle}</div>
                <div className="text-xs text-muted-foreground">
                  {formatAttemptDateTime(a.startedAt)} · scored {a.score}%
                </div>
              </div>
              <Badge variant={a.result === "Pass" ? "default" : "destructive"} className={a.result === "Pass" ? "bg-success/15 text-success border-0" : ""}>
                {a.result}
              </Badge>
            </div>
          ))}
          {data && !data.recentAttempts.length && (
            <p className="text-sm text-muted-foreground">No attempts yet — purchase an exam to get started.</p>
          )}
        </div>
        <Link to="/dashboard/history" className="mt-4 inline-flex text-xs font-medium text-accent hover:underline">
          View exam history <ArrowRight className="ml-0.5 inline h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
