import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard-bits";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiAuth } from "@/lib/api-auth";
import { formatAttemptDate, formatAttemptTime } from "@/lib/format-datetime";
import { usePageDataLoad } from "@/contexts/page-load-context";

type AttemptRow = {
  id: string;
  examTitle: string;
  startedAt: string;
  endedAt: string | null;
  duration: string;
  score: number;
  result: string;
};

export const Route = createFileRoute("/dashboard/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);

  usePageDataLoad(
    "history",
    async () => {
      const d = await apiAuth<{ attempts: AttemptRow[] }>("/api/candidate/attempts");
      setAttempts(d.attempts);
    },
    [],
  );

  const total = attempts.length;
  const passed = attempts.filter((a) => a.result === "Pass").length;

  return (
    <>
      <PageHeader title="Exam History" sub="Every attempt with date, time, score, and result." />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Tile k="Total attempts" v={total} />
        <Tile k="Passed" v={passed} c="text-success" />
        <Tile k="Failed" v={total - passed} c="text-destructive" />
        <Tile k="Avg. score" v={total ? `${Math.round(attempts.reduce((a, b) => a + b.score, 0) / total)}%` : "—"} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exam</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attempts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No completed attempts yet.
                </TableCell>
              </TableRow>
            ) : (
              attempts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.examTitle}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatAttemptDate(a.startedAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatAttemptTime(a.startedAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.duration}</TableCell>
                  <TableCell className="font-semibold">{a.score}%</TableCell>
                  <TableCell>
                    {a.result === "Pass" ? (
                      <Badge className="border-0 bg-success/15 text-success"><CheckCircle2 className="mr-1 h-3 w-3" /> Pass</Badge>
                    ) : (
                      <Badge variant="destructive" className="bg-destructive/15 text-destructive"><XCircle className="mr-1 h-3 w-3" /> Fail</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function Tile({ k, v, c }: { k: string; v: string | number; c?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className={`mt-2 font-display text-2xl font-bold ${c ?? ""}`}>{v}</div>
    </div>
  );
}
