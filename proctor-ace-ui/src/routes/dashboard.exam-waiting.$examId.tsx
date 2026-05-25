import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/dashboard-bits";
import { Button } from "@/components/ui/button";
import { apiAuth } from "@/lib/api-auth";
import { formatCountdown } from "@/lib/exam-schedule";

export const Route = createFileRoute("/dashboard/exam-waiting/$examId")({
  component: ExamWaitingRoom,
});

type ScheduleStatus = {
  examTitle: string;
  phase: string;
  scheduledLabel: string;
  msUntilStart: number;
  canStart: boolean;
  inProgressAttemptId: string | null;
};

function ExamWaitingRoom() {
  const { examId } = Route.useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ScheduleStatus | null>(null);
  const [msUntilStart, setMsUntilStart] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    const d = await apiAuth<ScheduleStatus>(`/api/candidate/exams/${examId}/schedule`);
    setStatus(d);
    setMsUntilStart(d.msUntilStart);
    if (d.inProgressAttemptId) {
      navigate({ to: "/dashboard/exam/$attemptId", params: { attemptId: d.inProgressAttemptId } });
    }
    setLoading(false);
  }, [examId, navigate]);

  useEffect(() => {
    void loadStatus();
    const poll = setInterval(() => void loadStatus(), 15000);
    return () => clearInterval(poll);
  }, [loadStatus]);

  useEffect(() => {
    const t = setInterval(() => setMsUntilStart((m) => Math.max(0, m - 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <PageHeader title="Waiting room" sub={status?.examTitle ?? "Your scheduled exam"} />
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-emerald/15 text-emerald-600">
          <Clock className="h-7 w-7" />
        </div>
        <p className="text-sm text-muted-foreground">Scheduled for</p>
        <p className="mt-1 font-display text-xl font-semibold">{status?.scheduledLabel ?? "—"}</p>
        <p className="mt-6 text-sm text-muted-foreground">
          You joined early. Stay on this page — the exam opens at your scheduled start time.
        </p>
        {loading ? (
          <Loader2 className="mx-auto mt-6 h-8 w-8 animate-spin text-muted-foreground" />
        ) : status?.canStart ? (
          <div className="mt-6 space-y-4">
            <p className="font-medium text-emerald-600">Your exam is ready to start.</p>
            <Button
              className="bg-gradient-emerald text-white"
              onClick={() => navigate({ to: "/dashboard/my-exams", search: { startExam: examId } })}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Start exam
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-6 font-display text-4xl font-bold tabular-nums text-emerald-600">
              {formatCountdown(msUntilStart)}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">until exam starts</p>
          </>
        )}
        <div className="mt-8 flex justify-center">
          <Button variant="outline" onClick={() => navigate({ to: "/dashboard/my-exams" })}>
            Back to My Exams
          </Button>
        </div>
      </div>
    </>
  );
}
