import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Clock, AlertTriangle } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { apiAuth } from "@/lib/api-auth";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ProctoringCapture } from "@/components/proctoring-capture";
import { FullscreenExitModal } from "@/components/fullscreen-exit-modal";
import { ViolationsLimitDialog } from "@/components/violations-limit-dialog";
import { acquireExamCamera, enterFullscreen, getExamCameraStream, releaseExamCamera } from "@/lib/exam-media-stream";
import { parseStoredExamSession, storeExamSession, type ExamStartPayload } from "@/lib/exam-session";
import { ExamReloadDialog } from "@/components/exam-reload-dialog";
import { useExamReloadGuard } from "@/hooks/use-exam-reload-guard";
import { abandonExamAttempt, cancelExamAttempt } from "@/lib/exam-attempt-api";

export const Route = createFileRoute("/dashboard/exam/$attemptId")({
  component: TakeExam,
});

function blockCopy(e: Event) {
  e.preventDefault();
}

function TakeExam() {
  const { attemptId } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<ExamStartPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(90 * 60);
  const [warnings, setWarnings] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [fullscreenExitOpen, setFullscreenExitOpen] = useState(false);
  const [violationsLimitOpen, setViolationsLimitOpen] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const submittingRef = useRef(false);
  const leavingRef = useRef(false);
  const flaggedHandledRef = useRef(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const handleAbandonForReload = useCallback(() => {
    if (leavingRef.current) return;
    void abandonExamAttempt(attemptId);
  }, [attemptId]);

  const reloadGuardEnabled = examStarted && !loadingSession && !submitting && !leavingRef.current;

  const { reloadOpen, stayOnExam, confirmReload } = useExamReloadGuard(
    reloadGuardEnabled,
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
          data = await apiAuth<ExamStartPayload>(`/api/attempts/session/${attemptId}`);
          storeExamSession(attemptId, data);
        }
        if (cancelled) return;
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
    async (message: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      leavingRef.current = true;
      setSubmitting(true);
      setFullscreenExitOpen(false);
      setViolationsLimitOpen(false);

      try {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        const res = await apiAuth<{
          score: number;
          result: string;
          passed: boolean;
          examTitle: string;
          passScore: number;
          credentialId: string | null;
        }>(`/api/attempts/${attemptId}/submit`, {
          method: "POST",
          body: JSON.stringify({ answers }),
        });
        sessionStorage.removeItem(`exam-${attemptId}`);
        releaseExamCamera();
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
      } catch (e) {
        releaseExamCamera();
        sessionStorage.removeItem(`exam-${attemptId}`);
        toast.error(e instanceof ApiError ? e.message : "Exam ended");
        navigate({ to: "/dashboard/my-exams" });
      }
    },
    [attemptId, answers, navigate],
  );

  const submitExam = useCallback(
    async (auto = false) => {
      await exitExam(auto ? "Time is up" : "Exam submitted");
    },
    [exitExam],
  );

  const handleFlagged = useCallback(() => {
    if (flaggedHandledRef.current || leavingRef.current) return;
    flaggedHandledRef.current = true;
    setViolationsLimitOpen(true);
    setTimeout(() => {
      void exitExam("Exam ended — 3 proctoring violations");
    }, 3500);
  }, [exitExam]);

  useEffect(() => {
    if (!session || examStarted || loadingSession) return;

    const start = async () => {
      if (session.exam.webcam) {
        let stream = getExamCameraStream();
        if (!stream) {
          try {
            stream = await acquireExamCamera();
            setMediaStream(stream);
          } catch {
            await failStartup("Camera not ready. Allow camera access and start again from My Exams.");
            return;
          }
        }
      }

      if (session.exam.fullscreen) {
        const ok = await enterFullscreen();
        if (!ok) {
          await failStartup("Fullscreen is required for this exam. Allow fullscreen and try again.");
          return;
        }
      }
      setExamStarted(true);
    };
    void start();
  }, [session, examStarted, loadingSession, failStartup]);

  useEffect(() => {
    if (!session?.exam.fullscreen || !examStarted || leavingRef.current) return;

    const onFsChange = () => {
      if (leavingRef.current || submittingRef.current) return;
      if (!document.fullscreenElement) {
        setFullscreenExitOpen(true);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [session?.exam.fullscreen, examStarted]);

  useEffect(() => {
    if (!examStarted || fullscreenExitOpen || violationsLimitOpen || leavingRef.current) return;
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
  }, [examStarted, fullscreenExitOpen, violationsLimitOpen, submitExam]);

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

  useEffect(() => () => {
    if (!leavingRef.current && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  if (loadingSession || !session?.questions?.length) {
    return (
      <div className="flex min-h-screen items-center justify-center select-none bg-background">
        <p className="text-muted-foreground">Loading exam session…</p>
      </div>
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
            paused={fullscreenExitOpen || violationsLimitOpen}
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
          style={{ pointerEvents: fullscreenExitOpen || violationsLimitOpen ? "none" : "auto" }}
        >
          <div className="mx-auto max-w-2xl space-y-8">
            {session.questions.map((q, i) => (
              <div key={q.id} className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">Question {i + 1}</p>
                <p className="mt-2 font-medium">{q.title}</p>
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

        <footer className="shrink-0 border-t p-4" style={{ pointerEvents: fullscreenExitOpen || violationsLimitOpen ? "none" : "auto" }}>
          <Button
            className="w-full bg-gradient-emerald text-white"
            disabled={submitting || fullscreenExitOpen || violationsLimitOpen || !examStarted}
            onClick={() => void submitExam(false)}
          >
            {submitting ? "Submitting…" : "Submit exam"}
          </Button>
        </footer>
      </div>
    </>
  );
}
