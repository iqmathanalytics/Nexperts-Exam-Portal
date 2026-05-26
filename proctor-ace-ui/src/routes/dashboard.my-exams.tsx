import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarClock, ClipboardList, DoorOpen, PlayCircle, CalendarRange } from "lucide-react";
import { RescheduleExamDialog } from "@/components/reschedule-exam-dialog";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard-bits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiAuth } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-client";
import { ExamPrestartDialog } from "@/components/exam-prestart-dialog";
import { acquireExamCamera, releaseExamCamera } from "@/lib/exam-media-stream";
import { storeExamSession, type ExamStartPayload } from "@/lib/exam-session";
import { cancelExamAttempt } from "@/lib/exam-attempt-api";
import { usePageDataLoad } from "@/contexts/page-load-context";
import type { SchedulePhase } from "@/lib/exam-schedule";

export const Route = createFileRoute("/dashboard/my-exams")({
  component: MyExams,
  validateSearch: (s: Record<string, unknown>) => ({
    startExam: typeof s.startExam === "string" ? s.startExam : undefined,
  }),
});

type PurchasedExam = {
  id: string;
  paymentId: string;
  title: string;
  category: string;
  duration: number;
  questions: number;
  passScore: number;
  attempts: number;
  used: number;
  lastResult?: string;
  lastScore?: number;
  proctoring?: boolean;
  webcam?: boolean;
  schedulePhase: SchedulePhase;
  schedule?: {
    scheduledLabel: string;
    scheduledStartAt: string;
    scheduledEndAt: string;
  } | null;
  inProgressAttemptId?: string | null;
};

function MyExams() {
  const navigate = useNavigate();
  const { startExam: startExamFromSearch } = Route.useSearch();
  const [exams, setExams] = useState<PurchasedExam[]>([]);
  const [starting, setStarting] = useState<string | null>(null);
  const [prestartExam, setPrestartExam] = useState<PurchasedExam | null>(null);
  const [rescheduleExam, setRescheduleExam] = useState<PurchasedExam | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  usePageDataLoad(
    "my-exams",
    async () => {
      const d = await apiAuth<{ exams: PurchasedExam[] }>("/api/candidate/my-exams");
      setExams(d.exams);
    },
    [reloadKey],
  );

  useEffect(() => {
    if (!startExamFromSearch || exams.length === 0) return;
    const exam = exams.find((e) => e.id === startExamFromSearch);
    if (exam && (exam.schedulePhase === "ready" || exam.schedulePhase === "in_progress")) {
      setPrestartExam(exam);
      navigate({ to: "/dashboard/my-exams", search: {}, replace: true });
    }
  }, [startExamFromSearch, exams, navigate]);

  const beginExamApi = async (examId: string) => {
    setStarting(examId);
    let attemptId: string | null = null;
    try {
      if (prestartExam?.webcam !== false) {
        await acquireExamCamera();
      }

      const res = await apiAuth<ExamStartPayload & { resumed?: boolean }>("/api/attempts/start", {
        method: "POST",
        body: JSON.stringify({ examId }),
      });

      if (!res.questions?.length || !res.endsAt || !res.exam?.title) {
        throw new Error("Exam session incomplete. Please try again.");
      }

      attemptId = res.attemptId;
      storeExamSession(res.attemptId, res);
      setPrestartExam(null);
      navigate({ to: "/dashboard/exam/$attemptId", params: { attemptId: res.attemptId } });
    } catch (e) {
      if (attemptId) await cancelExamAttempt(attemptId);
      releaseExamCamera();
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not start exam";
      toast.error(msg);
      if (e instanceof ApiError && e.message.includes("waiting room")) {
        navigate({ to: "/dashboard/exam-waiting/$examId", params: { examId } });
      }
    } finally {
      setStarting(null);
    }
  };

  const actionFor = (e: PurchasedExam) => {
    const remaining = e.attempts - e.used;
    if (remaining <= 0) return { label: "No attempts left", disabled: true, action: null as (() => void) | null };
    if (e.inProgressAttemptId) {
      return {
        label: "Resume exam",
        disabled: false,
        action: () =>
          navigate({ to: "/dashboard/exam/$attemptId", params: { attemptId: e.inProgressAttemptId! } }),
      };
    }
    switch (e.schedulePhase) {
      case "waiting":
        return {
          label: "Join waiting room",
          disabled: false,
          action: () => navigate({ to: "/dashboard/exam-waiting/$examId", params: { examId: e.id } }),
        };
      case "ready":
      case "in_progress":
      case "not_scheduled":
        return {
          label: "Start Exam",
          disabled: false,
          action: () => setPrestartExam(e),
        };
      case "expired":
      case "booking_expired":
        return {
          label: e.schedulePhase === "booking_expired" ? "Booking expired" : "Reschedule",
          disabled: e.schedulePhase === "booking_expired",
          action:
            e.schedulePhase === "booking_expired"
              ? null
              : () => setRescheduleExam(e),
        };
      case "too_early":
        return {
          label: "Scheduled",
          disabled: true,
          action: null,
          hint: e.schedule?.scheduledLabel,
        };
      default:
        return { label: "Start Exam", disabled: false, action: () => setPrestartExam(e) };
    }
  };

  return (
    <>
      <PageHeader title="My Exams" sub="Track your scheduled exams, attempts, and results." />

      <RescheduleExamDialog
        open={!!rescheduleExam}
        onOpenChange={(o) => !o && setRescheduleExam(null)}
        paymentId={rescheduleExam?.paymentId ?? ""}
        examId={rescheduleExam?.id ?? ""}
        examTitle={rescheduleExam?.title ?? ""}
        duration={rescheduleExam?.duration ?? 60}
        onRescheduled={() => setReloadKey((k) => k + 1)}
      />

      <ExamPrestartDialog
        open={!!prestartExam}
        examTitle={prestartExam?.title ?? ""}
        requiresWebcam={prestartExam?.webcam !== false}
        onCancel={() => {
          releaseExamCamera();
          setPrestartExam(null);
        }}
        onReady={() => prestartExam && beginExamApi(prestartExam.id)}
      />

      {exams.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scheduled exams yet. Browse available exams to schedule one.</p>
      ) : (
        <div className="space-y-4">
          {exams.map((e) => {
            const remaining = e.attempts - e.used;
            const act = actionFor(e);
            return (
              <div key={e.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-emerald text-white">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-semibold">{e.title}</h3>
                        <Badge variant="secondary" className="text-xs">{e.category}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {e.duration} min · {e.questions} questions · Pass {e.passScore}%
                      </div>
                      {e.schedule?.scheduledLabel && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Scheduled: <span className="font-medium text-foreground">{e.schedule.scheduledLabel}</span>
                        </div>
                      )}
                      {e.lastResult && (
                        <div className="mt-2 text-xs">
                          Last attempt: <span className="font-medium">{e.lastResult}</span>
                          {e.lastScore != null && ` · ${e.lastScore}%`}
                        </div>
                      )}
                      {"hint" in act && act.hint && (
                        <p className="mt-1 text-xs text-muted-foreground">Opens {act.hint} (join 10 min early)</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right text-xs text-muted-foreground">
                      {remaining} of {e.attempts} attempts left
                    </div>
                    <Progress value={(e.used / e.attempts) * 100} className="h-2 w-32" />
                    <div className="flex gap-2">
                      {(e.schedulePhase === "expired" || e.schedulePhase === "too_early") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRescheduleExam(e)}
                        >
                          <CalendarRange className="mr-2 h-4 w-4" />
                          Reschedule
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={act.disabled || starting === e.id}
                        className="bg-gradient-emerald text-white"
                        onClick={() => act.action?.()}
                      >
                        {e.schedulePhase === "waiting" ? (
                          <DoorOpen className="mr-2 h-4 w-4" />
                        ) : (
                          <PlayCircle className="mr-2 h-4 w-4" />
                        )}
                        {starting === e.id ? "Starting…" : act.label}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
