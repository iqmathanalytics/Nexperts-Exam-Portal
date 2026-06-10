import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, AlertTriangle, Loader2 } from "lucide-react";
import { apiAuth } from "@/lib/api-auth";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ClientOnly } from "@/components/client-only";
import { ProctoringCapture } from "@/components/proctoring-capture";
import { FullscreenExitModal } from "@/components/fullscreen-exit-modal";
import { ExamSubmitConfirmModal } from "@/components/exam-submit-confirm-modal";
import { ViolationsLimitDialog } from "@/components/violations-limit-dialog";
import { acquireExamCamera, getExamCameraStream, isExamFullscreen, releaseExamCamera } from "@/lib/exam-media-stream";
import { ExamFullscreenGate } from "@/components/exam-fullscreen-gate";
import { QuestionCodeBlock } from "@/components/question-code-block";
import { parseStoredExamSession, storeExamSession, type ExamStartPayload } from "@/lib/exam-session";
import { ExamReloadDialog } from "@/components/exam-reload-dialog";
import { useExamReloadGuard } from "@/hooks/use-exam-reload-guard";
import { abandonExamAttempt, cancelExamAttempt, finalizeExamAttempt } from "@/lib/exam-attempt-api";
import { invalidateExamCaches } from "@/lib/invalidate-exam-caches";

export const Route = createFileRoute("/dashboard/exam/$attemptId")({
  component: () => (
    <ClientOnly>
      <TakeExam />
    </ClientOnly>
  ),
});

function blockCopy(e: Event) {
  e.preventDefault();
}

function TakeExam() {
  const { attemptId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<ExamStartPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const [secondsLeft, setSecondsLeft] = useState(90 * 60);
  const [warnings, setWarnings] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [fullscreenExitOpen, setFullscreenExitOpen] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [violationsLimitOpen, setViolationsLimitOpen] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [awaitingFullscreen, setAwaitingFullscreen] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const submittingRef = useRef(false);
  const leavingRef = useRef(false);
  const flaggedHandledRef = useRef(false);
  const leaveAbandonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const handleAbandonForReload = useCallback(async () => {
    if (leavingRef.current) return;
    await abandonExamAttempt(attemptId);
    invalidateExamCaches(queryClient);
  }, [attemptId, queryClient]);

  const reloadGuardEnabled = examStarted && !loadingSession && !submitting && !leavingRef.current;

  const { reloadOpen, stayOnExam, confirmReload } = useExamReloadGuard(
    reloadGuardEnabled,
    attemptId,
    handleAbandonForReload,
  );

  const failStartup = useCallback(
    async (message: string) => {
      leavingRef.current = true;
      await cancelExamAttempt(attemptId);
      releaseExamCamera();
      toast.error(message);
      navigate({ to: "/dashboard/my-exams" });
    },
    [attemptId, navigate],
  );

  useEffect(() => {
    setMediaStream(getExamCameraStream());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      setLoadingSession(true);
      try {
        let data = parseStoredExamSession(attemptId);
        if (!data) {
          try {
            data = await apiAuth<ExamStartPayload>(`/api/attempts/session/${attemptId}`);
            storeExamSession(attemptId, data);
          } catch {
            if (!cancelled) await failStartup("Could not load exam session. Start again from My Exams.");
            return;
          }
        }
        if (cancelled) return;
        if (!data.attemptId) data.attemptId = attemptId;
        if (!data.questions?.length) {
          await failStartup("Exam has no questions. Contact support.");
          return;
        }
        setSession(data);
        const ends = new Date(data.endsAt).getTime();
        setSecondsLeft(Math.max(0, Math.floor((ends - Date.now()) / 1000)));
      } catch {
        if (!cancelled) await failStartup("Could not load exam session. Start again from My Exams.");
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [attemptId, failStartup]);

  const exitExam = useCallback(
    async (_message: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      leavingRef.current = true;
      setSubmitting(true);
      setFullscreenExitOpen(false);
      setViolationsLimitOpen(false);

      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});

      const res = await finalizeExamAttempt(attemptId, answersRef.current);
      releaseExamCamera();
      invalidateExamCaches(queryClient);

      if (res) {
        navigate({
          to: "/exam-complete",
          search: {
            score: res.score,
            result: res.result,
            passed: res.passed ? "1" : "0",
            exam: res.examTitle ?? session?.exam.title ?? "Exam",
            passScore: res.passScore ?? session?.exam.passScore ?? 70,
            credentialId: res.credentialId ?? "",
          },
        });
        return;
      }

      toast.error("Exam ended — your attempt has been recorded.");
      navigate({ to: "/dashboard/my-exams" });
    },
    [attemptId, navigate, queryClient, session?.exam.passScore, session?.exam.title],
  );

  const submitExam = useCallback(
    async (auto = false) => {
      await exitExam(auto ? "Time is up" : "Exam submitted");
    },
    [exitExam],
  );

  const requestSubmit = useCallback(() => {
    if (session?.exam.fullscreen && document.fullscreenElement) {
      setSubmitConfirmOpen(true);
      return;
    }
    void submitExam(false);
  }, [session?.exam.fullscreen, submitExam]);

  const confirmSubmit = useCallback(async () => {
    setSubmitConfirmOpen(false);
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
    await submitExam(false);
  }, [submitExam]);

  const handleFlagged = useCallback(() => {
    if (flaggedHandledRef.current || leavingRef.current) return;
    flaggedHandledRef.current = true;
    setViolationsLimitOpen(true);
    setTimeout(() => {
      void exitExam("Exam ended — 3 proctoring violations");
    }, 3500);
  }, [exitExam]);

  useEffect(() => {
    if (!session || examStarted || loadingSession || awaitingFullscreen) return;

    const prepare = async () => {
      if (session.exam.webcam) {
        let stream = getExamCameraStream();
        if (!stream) {
          try {
            stream = await acquireExamCamera();
          } catch {
            await failStartup("Camera not ready. Allow camera access and start again from My Exams.");
            return;
          }
        }
        setMediaStream(stream);
      }

      if (session.exam.fullscreen && !isExamFullscreen()) {
        setAwaitingFullscreen(true);
        return;
      }

      setExamStarted(true);
    };

    void prepare();
  }, [session, examStarted, loadingSession, awaitingFullscreen, failStartup]);

  useEffect(() => {
    if (!session?.exam.fullscreen || !examStarted || leavingRef.current) return;

    const onFsChange = () => {
      if (leavingRef.current || submittingRef.current || submitConfirmOpen) return;
      if (!document.fullscreenElement) {
        setFullscreenExitOpen(true);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [session?.exam.fullscreen, examStarted, submitConfirmOpen]);

  useEffect(() => {
    if (!examStarted || fullscreenExitOpen || violationsLimitOpen || submitConfirmOpen || leavingRef.current) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          void submitExam(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [examStarted, fullscreenExitOpen, violationsLimitOpen, submitConfirmOpen, submitExam]);

  useEffect(() => {
    const opts = { capture: true };
    document.addEventListener("copy", blockCopy, opts);
    document.addEventListener("cut", blockCopy, opts);
    document.addEventListener("paste", blockCopy, opts);
    document.addEventListener("contextmenu", blockCopy, opts);
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "v", "a", "p", "s"].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("copy", blockCopy, opts);
      document.removeEventListener("cut", blockCopy, opts);
      document.removeEventListener("paste", blockCopy, opts);
      document.removeEventListener("contextmenu", blockCopy, opts);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (leaveAbandonTimerRef.current) {
      clearTimeout(leaveAbandonTimerRef.current);
      leaveAbandonTimerRef.current = null;
    }
  }, [attemptId]);

  useEffect(() => {
    return () => {
      if (!leavingRef.current && !submittingRef.current) {
        leaveAbandonTimerRef.current = setTimeout(() => {
          void abandonExamAttempt(attemptId).then(() => invalidateExamCaches(queryClient));
        }, 50);
      }
      if (!leavingRef.current && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [attemptId, queryClient]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  if (loadingSession || !session?.questions?.length) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 select-none bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
        <p className="text-muted-foreground">Loading exam session…</p>
      </div>
    );
  }

  if (awaitingFullscreen) {
    return (
      <ExamFullscreenGate
        examTitle={session.exam.title}
        onEntered={() => {
          setAwaitingFullscreen(false);
          setExamStarted(true);
        }}
      />
    );
  }

  return (
    <>
      <ExamReloadDialog
        open={reloadOpen && !leavingRef.current}
        examTitle={session.exam.title}
        onStay={stayOnExam}
        onReload={confirmReload}
      />
      <ViolationsLimitDialog open={violationsLimitOpen} examTitle={session.exam.title} />
      <ExamSubmitConfirmModal
        open={submitConfirmOpen && !leavingRef.current}
        examTitle={session.exam.title}
        onCancel={() => setSubmitConfirmOpen(false)}
        onConfirm={() => void confirmSubmit()}
      />
      <FullscreenExitModal
        open={fullscreenExitOpen && !leavingRef.current}
        onResumed={() => setFullscreenExitOpen(false)}
        onExitExam={() => void exitExam("Exam ended — fullscreen not restored in time")}
      />

      <div
        className="fixed inset-0 z-50 flex flex-col bg-background select-none"
        style={{ WebkitUserSelect: "none", userSelect: "none" }}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {session.exam.proctoring && examStarted && (
          <ProctoringCapture
            attemptId={attemptId}
            settings={session.exam}
            mediaStream={mediaStream}
            paused={fullscreenExitOpen || violationsLimitOpen || submitConfirmOpen}
            onWarningsChange={setWarnings}
            onViolation={(type) => toast.warning(type)}
            onFlagged={handleFlagged}
          />
        )}

        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <div className="font-display font-semibold">{session.exam.title}</div>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 font-mono text-lg font-bold text-accent">
              <Clock className="h-4 w-4" /> {mm}:{ss}
            </span>
            {session.exam.proctoring && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-4 w-4" /> {warnings}/3
              </span>
            )}
          </div>
        </header>

        <main
          className="flex-1 overflow-y-auto p-6 pb-48"
          style={{ pointerEvents: fullscreenExitOpen || violationsLimitOpen || submitConfirmOpen ? "none" : "auto" }}
        >
          <div className="mx-auto max-w-2xl space-y-8">
            {session.questions.map((q, i) => (
              <div key={q.id} className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">Question {i + 1}</p>
                <p className="mt-2 font-medium">{q.title}</p>
                <QuestionCodeBlock code={"code" in q ? q.code : null} />
                {"imageUrl" in q && q.imageUrl && (
                  <img src={q.imageUrl as string} alt="" className="mt-3 max-h-48 rounded-md border border-border object-contain" />
                )}
                <RadioGroup
                  className="mt-4 space-y-2"
                  value={answers[q.id] ?? ""}
                  onValueChange={(v) => setAnswers({ ...answers, [q.id]: v })}
                >
                  {q.options.map((o) => (
                    <div key={o} className="flex items-center gap-2">
                      <RadioGroupItem value={o} id={`${q.id}-${o}`} />
                      <Label htmlFor={`${q.id}-${o}`} className="select-none">{o}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ))}
          </div>
        </main>

        <footer className="shrink-0 border-t p-4" style={{ pointerEvents: fullscreenExitOpen || violationsLimitOpen || submitConfirmOpen ? "none" : "auto" }}>
          <Button
            className="w-full bg-gradient-emerald text-white"
            disabled={submitting || fullscreenExitOpen || violationsLimitOpen || submitConfirmOpen || !examStarted}
            onClick={requestSubmit}
          >
            {submitting ? "Submitting…" : "Submit exam"}
          </Button>
        </footer>
      </div>
    </>
  );
}
