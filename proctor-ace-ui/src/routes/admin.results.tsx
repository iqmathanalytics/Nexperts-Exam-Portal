import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { apiAuth } from "@/lib/api-auth";
import { usePageDataLoad } from "@/contexts/page-load-context";
import { useAdminSearch } from "@/contexts/admin-search-context";
import { Pie, PieChart, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { PageHeader, StatusBadge, DataToolbar } from "@/components/admin-bits";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type ResultRow = { id: string; candidate: string; exam: string; score: number; result: string; date: string; attempts?: number };

export const Route = createFileRoute("/admin/results")({
  component: AdminResults,
});

function AdminResults() {
  const { query: search, setQuery: setSearch } = useAdminSearch();
  const [filterExam, setFilterExam] = useState("all");
  const [results, setResults] = useState<ResultRow[]>([]);

  const [exams, setExams] = useState<{ id: string; title: string }[]>([]);

  usePageDataLoad(
    "admin-results",
    async () => {
      const q = filterExam !== "all" ? `?examId=${filterExam}` : "";
      const [resultsRes, examsRes] = await Promise.all([
        apiAuth<{ results: ResultRow[] }>(`/api/admin/results${q}`),
        apiAuth<{ exams: { id: string; title: string }[] }>("/api/admin/exams"),
      ]);
      setResults(resultsRes.results);
      setExams(examsRes.exams);
    },
    [filterExam],
  );

  const pass = results.filter((r) => r.result === "Pass").length;
  const fail = results.filter((r) => r.result === "Fail").length;
  const pieData = [
    { name: "Pass", value: pass || 1, color: "oklch(0.55 0.14 165)" },
    { name: "Fail", value: fail || 0, color: "oklch(0.55 0.2 25)" },
  ];

  const filtered = results.filter((r) => r.candidate.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader title="Results" sub="Pass/fail analytics and score filtering." />

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Filter by exam</Label>
          <Select value={filterExam} onValueChange={setFilterExam}>
            <SelectTrigger className="w-64"><SelectValue placeholder="All exams" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All exams</SelectItem>
              {exams.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-1">
          <h3 className="font-display font-semibold">Pass / fail ratio</h3>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={70}>
                  {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <DataToolbar search={search} onSearch={setSearch} placeholder="Filter by candidate..." hideInput />
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                  <th className="p-4">Candidate</th><th>Exam</th><th>Score</th><th>Attempts</th><th>Result</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/20">
                    <td className="p-4 font-medium">{r.candidate}</td>
                    <td className="p-4">{r.exam}</td>
                    <td className="p-4">{r.score}%</td>
                    <td className="p-4">{r.attempts ?? 1}</td>
                    <td className="p-4"><StatusBadge status={r.result} /></td>
                    <td className="p-4">{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
