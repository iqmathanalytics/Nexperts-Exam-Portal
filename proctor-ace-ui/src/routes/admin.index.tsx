import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Users, BookOpen, DollarSign, CheckCircle2, XCircle, Monitor, AlertTriangle, Ticket } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard, PageHeader, StatusBadge } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { apiAuth } from "@/lib/api-auth";
import { usePageDataLoad } from "@/contexts/page-load-context";
import { useAdminSearch } from "@/contexts/admin-search-context";

type AdminStats = {
  totalUsers: number;
  activeExams: number;
  revenue: number;
  passed: number;
  failed: number;
  ongoing: number;
  violations: number;
  voucherUsage: number;
};

type AdminSecondary = {
  revenueChartData: { month: string; revenue: number }[];
  examActivityData: { day: string; attempts: number }[];
  payments: { user: string; exam: string; amount: number; status: string; date: string }[];
  results: { candidate: string; exam: string; score: number; result: string }[];
};

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { query: search } = useAdminSearch();

  const { data: statsData, isPending: statsPending } = usePageDataLoad(
    "admin-home-stats",
    () => apiAuth<AdminStats>("/api/admin/stats"),
    [],
  );

  const { data: secondaryData, isPending: secondaryPending } = usePageDataLoad(
    "admin-home-secondary",
    async (): Promise<AdminSecondary> => {
      const [chartsRes, paymentsRes, resultsRes] = await Promise.all([
        apiAuth<{ revenueChartData: AdminSecondary["revenueChartData"]; examActivityData: AdminSecondary["examActivityData"] }>("/api/admin/charts"),
        apiAuth<{ payments: AdminSecondary["payments"] }>("/api/admin/payments"),
        apiAuth<{ results: { candidate: string; exam: string; score: number; result: string }[] }>("/api/admin/results"),
      ]);
      return {
        revenueChartData: chartsRes.revenueChartData,
        examActivityData: chartsRes.examActivityData,
        payments: paymentsRes.payments.slice(0, 5),
        results: resultsRes.results.slice(0, 5),
      };
    },
    [],
  );

  const isPending = statsPending;

  const stats: AdminStats = statsData ?? {
    totalUsers: 0,
    activeExams: 0,
    revenue: 0,
    passed: 0,
    failed: 0,
    ongoing: 0,
    violations: 0,
    voucherUsage: 0,
  };
  const revenueChartData = secondaryData?.revenueChartData ?? [];
  const examActivityData = secondaryData?.examActivityData ?? [];
  const payments = secondaryData?.payments ?? [];
  const results = secondaryData?.results ?? [];

  const q = search.toLowerCase().trim();
  const filteredResults = q
    ? results.filter(
        (r) =>
          r.candidate.toLowerCase().includes(q) ||
          r.exam.toLowerCase().includes(q) ||
          r.result.toLowerCase().includes(q),
      )
    : results;
  const filteredPayments = q
    ? payments.filter(
        (p) =>
          p.user.toLowerCase().includes(q) ||
          p.exam.toLowerCase().includes(q) ||
          String(p.status).toLowerCase().includes(q),
      )
    : payments;

  return (
    <div className="space-y-6">
      <PageHeader title="Admin dashboard" sub="Live data from TiDB." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={stats.totalUsers.toLocaleString()} icon={Users} loading={isPending} />
        <StatCard label="Active exams" value={stats.activeExams} icon={BookOpen} accent="blue" loading={isPending} />
        <StatCard label="Revenue (MYR)" value={stats.revenue.toLocaleString()} icon={DollarSign} accent="gold" loading={isPending} />
        <StatCard label="Passed" value={stats.passed} icon={CheckCircle2} accent="emerald" loading={isPending} />
        <StatCard label="Failed" value={stats.failed} icon={XCircle} accent="rose" loading={isPending} />
        <StatCard label="Ongoing" value={stats.ongoing} icon={Monitor} accent="blue" loading={isPending} />
        <StatCard label="Violations" value={stats.violations} icon={AlertTriangle} accent="rose" loading={isPending} />
        <StatCard label="Voucher usage" value={`${stats.voucherUsage}%`} icon={Ticket} accent="gold" loading={isPending} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h3 className="font-display font-semibold">Revenue trend</h3>
          <div className="mt-4 h-56">
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="oklch(0.55 0.14 165)" fill="oklch(0.55 0.14 165 / 0.2)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No revenue data yet</p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h3 className="font-display font-semibold">Exam activity (7 days)</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={examActivityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="attempts" fill="oklch(0.45 0.12 250)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="table-panel rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display font-semibold">Recent results</h3>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {secondaryPending && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2"><div className="h-4 w-28 animate-pulse rounded bg-muted" /></td>
                  <td><div className="h-4 w-32 animate-pulse rounded bg-muted" /></td>
                  <td><div className="h-4 w-10 animate-pulse rounded bg-muted" /></td>
                  <td><div className="h-4 w-12 animate-pulse rounded bg-muted" /></td>
                </tr>
              ))}
              {!secondaryPending && filteredResults.length === 0 && q && (
                <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No results match your search</td></tr>
              )}
              {!secondaryPending && filteredResults.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2">{r.candidate}</td>
                  <td>{r.exam}</td>
                  <td>{r.score}%</td>
                  <td><StatusBadge status={r.result} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button asChild variant="ghost" size="sm" className="mt-2"><Link to="/admin/results">View all</Link></Button>
        </div>
        <div className="table-panel rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display font-semibold">Recent payments</h3>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {secondaryPending && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2"><div className="h-4 w-28 animate-pulse rounded bg-muted" /></td>
                  <td><div className="h-4 w-16 animate-pulse rounded bg-muted" /></td>
                  <td><div className="h-4 w-14 animate-pulse rounded bg-muted" /></td>
                </tr>
              ))}
              {!secondaryPending && filteredPayments.length === 0 && q && (
                <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">No payments match your search</td></tr>
              )}
              {!secondaryPending && filteredPayments.map((p, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2">{p.user}</td>
                  <td>MYR {p.amount}</td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button asChild variant="ghost" size="sm" className="mt-2"><Link to="/admin/payments">View all</Link></Button>
        </div>
      </div>
    </div>
  );
}
