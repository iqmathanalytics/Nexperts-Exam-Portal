import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { apiAuth } from "@/lib/api-auth";
import { usePageDataLoad } from "@/contexts/page-load-context";
import { useAdminSearch } from "@/contexts/admin-search-context";
import { AlertTriangle, Monitor, Maximize2, Smartphone } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/admin-bits";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Session = {
  id: string;
  userId: string;
  examId: string;
  candidate: string;
  exam: string;
  started: string;
  warnings: number;
  status: string;
  violations: { type: string; time: string }[];
};

type ActivityRow = {
  time: string;
  userId?: string;
  candidate: string;
  exam?: string;
  examId?: string;
  event: string;
  severity: string;
};

type FilterOptions = {
  exams: { id: string; title: string }[];
  students: { id: string; name: string }[];
};

export const Route = createFileRoute("/admin/monitoring")({
  component: ExamMonitoring,
});

function ExamMonitoring() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityRow[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ exams: [], students: [] });
  const [filterExam, setFilterExam] = useState("all");
  const [filterStudent, setFilterStudent] = useState("all");
  const { query: globalSearch } = useAdminSearch();

  const fetchMonitoring = async () => {
    const d = await apiAuth<{
      sessions: Session[];
      activityLog: ActivityRow[];
      filterOptions: FilterOptions;
    }>("/api/admin/monitoring");
    setSessions(d.sessions);
    setActivityLog(d.activityLog);
    setFilterOptions(d.filterOptions ?? { exams: [], students: [] });
  };

  usePageDataLoad("monitoring", fetchMonitoring, []);

  useEffect(() => {
    const t = setInterval(() => {
      void fetchMonitoring().catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, []);

  const examOptions = useMemo(() => {
    const fromApi = filterOptions.exams ?? [];
    const fromLog = activityLog
      .filter((r) => r.examId && r.exam)
      .map((r) => ({ id: r.examId!, title: r.exam! }));
    const map = new Map<string, string>();
    for (const e of [...fromApi, ...fromLog, ...sessions.map((s) => ({ id: s.examId, title: s.exam }))]) {
      map.set(e.id, e.title);
    }
    return [...map.entries()].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [filterOptions.exams, activityLog, sessions]);

  const studentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of filterOptions.students ?? []) map.set(s.id, s.name);
    for (const row of activityLog) {
      if (row.userId) map.set(row.userId, row.candidate);
    }
    for (const s of sessions) map.set(s.userId, s.candidate);
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [filterOptions.students, activityLog, sessions]);

  const filteredSessions = sessions.filter((s) => {
    if (filterExam !== "all" && s.examId !== filterExam) return false;
    if (filterStudent !== "all" && s.userId !== filterStudent) return false;
    if (globalSearch.trim()) {
      const blob = `${s.candidate} ${s.exam} ${s.status}`.toLowerCase();
      if (!blob.includes(globalSearch.toLowerCase())) return false;
    }
    return true;
  });

  const filteredLog = activityLog.filter((row) => {
    if (filterStudent !== "all" && row.userId !== filterStudent) return false;
    if (filterExam !== "all" && row.examId !== filterExam) return false;
    if (globalSearch.trim()) {
      const blob = `${row.candidate} ${row.exam ?? ""} ${row.event} ${row.severity}`.toLowerCase();
      if (!blob.includes(globalSearch.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam monitoring"
        sub="Live violation tracking and session status (no live video feed for admins)."
      />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
        <div className="space-y-2">
          <Label className="text-xs">Filter by exam</Label>
          <Select value={filterExam} onValueChange={setFilterExam}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All exams" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All exams</SelectItem>
              {examOptions.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Filter by student</Label>
          <Select value={filterStudent} onValueChange={setFilterStudent}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All students" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All students</SelectItem>
              {studentOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredSessions.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground">
            {sessions.length === 0 ? "No live exam sessions right now." : "No sessions match filters."}
          </p>
        )}
        {filteredSessions.map((s) => (
          <div
            key={s.id}
            className={`rounded-2xl border bg-card p-5 shadow-soft ${s.status === "Flagged" ? "border-destructive/40" : "border-border"}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{s.candidate}</div>
                <div className="text-xs text-muted-foreground">{s.exam}</div>
              </div>
              <StatusBadge status={s.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-muted/50 p-2">
                <div className="text-muted-foreground">Started</div>
                <div className="font-medium">{s.started}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <div className="text-muted-foreground">Session ID</div>
                <div className="truncate font-mono text-[10px]">{s.id.slice(0, 12)}…</div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Warnings</span>
              <div className="flex gap-1">
                {[1, 2, 3].map((w) => (
                  <div key={w} className={`h-2 w-8 rounded-full ${w <= s.warnings ? "bg-destructive" : "bg-muted"}`} />
                ))}
              </div>
            </div>

            {s.violations.length > 0 && (
              <div className="mt-3 max-h-32 space-y-1 overflow-y-auto border-t pt-3">
                {s.violations.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
                    {v.type} · {v.time}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display font-semibold">Activity log</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Time</th><th>Candidate</th><th>Exam</th><th>Event</th><th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {filteredLog.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">No activity matches filters</td>
                </tr>
              ) : (
                filteredLog.map((row, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-3">{row.time}</td>
                    <td>{row.candidate}</td>
                    <td className="text-muted-foreground">{row.exam ?? "—"}</td>
                    <td className="flex items-center gap-2">
                      {row.event.includes("Tab") && <Monitor className="h-3 w-3" />}
                      {row.event.includes("Fullscreen") && <Maximize2 className="h-3 w-3" />}
                      {row.event.toLowerCase().includes("phone") && <Smartphone className="h-3 w-3" />}
                      {row.event.toLowerCase().includes("person") && <AlertTriangle className="h-3 w-3" />}
                      {row.event}
                    </td>
                    <td><Badge variant={row.severity === "Critical" ? "destructive" : "secondary"}>{row.severity}</Badge></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
