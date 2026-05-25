import { Router } from "express";
import { z } from "zod";
import { AttemptResult, PaymentStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { analyzeProctoringFrame } from "../services/proctoring-analyze.js";
import { getSchedulePhase } from "../services/exam-scheduling.js";

const violationDedupMs = 10_000;
const multiplePersonsDedupMs = 30_000;
const lastViolationByAttempt = new Map<string, Record<string, number>>();

const router = Router();

function attemptId(req: AuthedRequest) {
  return String(req.params.id);
}

async function buildExamStartPayload(
  attempt: { id: string; startedAt: Date },
  exam: {
    id: string;
    title: string;
    duration: number;
    passScore: number;
    questions: number;
    proctoring: boolean;
    fullscreen: boolean;
    tabDetection: boolean;
    webcam: boolean;
  },
  examId: string,
  scheduledEndAt?: Date | null,
) {
  let questions = await prisma.question.findMany({
    where: { examId },
    take: exam.questions,
  });
  if (questions.length === 0) {
    questions = buildFallbackQuestions(examId, exam.questions);
  }
  const endsAt =
    scheduledEndAt ??
    new Date(attempt.startedAt.getTime() + exam.duration * 60 * 1000);
  return {
    attemptId: attempt.id,
    exam: {
      id: exam.id,
      title: exam.title,
      duration: exam.duration,
      passScore: exam.passScore,
      proctoring: exam.proctoring,
      fullscreen: exam.fullscreen,
      tabDetection: exam.tabDetection,
      webcam: exam.webcam,
    },
    questions: questions.map((q) => ({
      id: q.id,
      title: q.title,
      type: q.type,
      options: q.options as string[],
    })),
    endsAt: endsAt.toISOString(),
  };
}

router.post("/start", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  try {
    const { examId } = z.object({ examId: z.string() }).parse(req.body);
    const userId = req.user!.sub;

    const paid = await prisma.payment.findFirst({
      where: { userId, examId, status: PaymentStatus.PAID },
      orderBy: { createdAt: "desc" },
    });
    if (!paid) return res.status(403).json({ error: "Schedule this exam before starting" });

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return res.status(404).json({ error: "Exam not found" });

    const attemptCount = await prisma.examAttempt.count({
      where: { userId, examId, result: { not: AttemptResult.IN_PROGRESS } },
    });
    if (attemptCount >= exam.maxAttempts) {
      return res.status(403).json({ error: "No attempts remaining" });
    }

    const inProgress = await prisma.examAttempt.findFirst({
      where: { userId, examId, result: AttemptResult.IN_PROGRESS },
    });

    if (paid.scheduledStartAt && paid.scheduledEndAt) {
      const phase = getSchedulePhase(paid.scheduledStartAt, paid.scheduledEndAt, {
        hasInProgress: !!inProgress,
        attemptsExhausted: attemptCount >= exam.maxAttempts,
      });
      if (phase === "too_early") {
        return res.status(403).json({
          error: "Exam not open yet. You can join the waiting room 10 minutes before start.",
          phase,
        });
      }
      if (phase === "waiting") {
        return res.status(403).json({
          error: "Please wait in the waiting room until your scheduled start time.",
          phase,
        });
      }
      if (phase === "expired" && !inProgress) {
        return res.status(403).json({
          error: "Your scheduled exam window has ended.",
          phase,
        });
      }
      if (phase !== "ready" && phase !== "in_progress" && !inProgress) {
        return res.status(403).json({ error: "Exam is not available to start", phase });
      }
    }

    if (inProgress) {
      const payload = await buildExamStartPayload(
        inProgress,
        exam,
        examId,
        paid.scheduledEndAt,
      );
      return res.json({ ...payload, resumed: true });
    }

    const attempt = await prisma.examAttempt.create({
      data: { userId, examId, result: AttemptResult.IN_PROGRESS },
    });

    const payload = await buildExamStartPayload(attempt, exam, examId, paid.scheduledEndAt);
    res.json(payload);
  } catch {
    res.status(400).json({ error: "Could not start exam" });
  }
});

router.get("/session/:id", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: String(req.params.id), userId: req.user!.sub, result: AttemptResult.IN_PROGRESS },
    include: { exam: true },
  });
  if (!attempt?.exam) return res.status(404).json({ error: "Active attempt not found" });
  const paid = await prisma.payment.findFirst({
    where: { userId: req.user!.sub, examId: attempt.examId, status: PaymentStatus.PAID },
    orderBy: { createdAt: "desc" },
  });
  const payload = await buildExamStartPayload(
    attempt,
    attempt.exam,
    attempt.examId,
    paid?.scheduledEndAt,
  );
  res.json(payload);
});

router.get("/:id", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId(req), userId: req.user!.sub },
    include: { exam: true, violations: true },
  });
  if (!attempt) return res.status(404).json({ error: "Attempt not found" });
  res.json({ attempt });
});

async function recordViolation(attemptId: string, userId: string, type: string, detail?: string) {
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId, result: AttemptResult.IN_PROGRESS },
  });
  if (!attempt) return null;

  const dedup = lastViolationByAttempt.get(attemptId) ?? {};
  const now = Date.now();
  const dedupMs = type === "Multiple persons detected" ? multiplePersonsDedupMs : violationDedupMs;
  if (dedup[type] && now - dedup[type] < dedupMs) {
    return { warnings: attempt.warnings, flagged: attempt.warnings >= 3 };
  }
  dedup[type] = now;
  lastViolationByAttempt.set(attemptId, dedup);

  await prisma.proctoringViolation.create({
    data: { attemptId, userId, type, detail },
  });

  const warnings = attempt.warnings + 1;
  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: { warnings },
  });

  return { warnings, flagged: warnings >= 3 };
}

router.post("/:id/violations", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  const { type, detail } = z.object({ type: z.string(), detail: z.string().optional() }).parse(req.body);
  const result = await recordViolation(attemptId(req), req.user!.sub, type, detail);
  if (!result) return res.status(404).json({ error: "Attempt not found" });
  res.json(result);
});

router.post("/:id/analyze-frame", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  const { frame } = z.object({ frame: z.string().min(100) }).parse(req.body);
  const id = attemptId(req);
  const attempt = await prisma.examAttempt.findFirst({
    where: { id, userId: req.user!.sub, result: AttemptResult.IN_PROGRESS },
    include: { exam: true },
  });
  if (!attempt) return res.status(404).json({ error: "Attempt not found" });
  if (!attempt.exam.proctoring) {
    return res.json({
      violations: [],
      violation_count: 0,
      face_detected: true,
      person_count: 0,
      phone_detected: false,
      source: "disabled",
    });
  }

  const analysis = await analyzeProctoringFrame(frame);
  const logged: string[] = [];

  for (const v of analysis.violations) {
    const r = await recordViolation(id, req.user!.sub, v);
    if (r) logged.push(v);
  }

  const updated = await prisma.examAttempt.findUnique({ where: { id } });
  const warnings = updated?.warnings ?? 0;
  res.json({
    ...analysis,
    violations: logged.length ? analysis.violations : analysis.violations,
    warnings,
    flagged: warnings >= 3,
  });
});

router.delete("/:id/cancel", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId(req), userId: req.user!.sub, result: AttemptResult.IN_PROGRESS },
  });
  if (!attempt) return res.status(404).json({ error: "Active attempt not found" });

  await prisma.examAttempt.delete({ where: { id: attempt.id } });
  res.json({ ok: true, message: "Attempt cancelled — not counted" });
});

router.post("/:id/abandon", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId(req), userId: req.user!.sub, result: AttemptResult.IN_PROGRESS },
  });
  if (!attempt) return res.status(404).json({ error: "Active attempt not found" });

  await prisma.examAttempt.update({
    where: { id: attempt.id },
    data: { result: AttemptResult.FAIL, score: 0, endedAt: new Date() },
  });
  res.json({ ok: true, message: "Attempt ended due to page reload" });
});

router.post("/:id/submit", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  const { answers } = z.object({ answers: z.record(z.string()) }).parse(req.body);
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId(req), userId: req.user!.sub },
    include: { exam: true },
  });
  if (!attempt?.exam) return res.status(404).json({ error: "Attempt not found" });

  const questions = await prisma.question.findMany({ where: { examId: attempt.examId } });
  const qs = questions.length ? questions : buildFallbackQuestions(attempt.examId, attempt.exam.questions);

  let correct = 0;
  for (const q of qs) {
    if (answers[q.id] === q.correctAnswer) correct++;
  }
  const score = Math.round((correct / qs.length) * 100);
  const passed = score >= attempt.exam.passScore;

  await prisma.examAttempt.update({
    where: { id: attempt.id },
    data: {
      score,
      result: passed ? AttemptResult.PASS : AttemptResult.FAIL,
      endedAt: new Date(),
    },
  });

  let credentialId: string | undefined;
  if (passed) {
    credentialId = `NX-${attempt.examId.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    await prisma.certificate.create({
      data: {
        userId: req.user!.sub,
        examId: attempt.examId,
        credentialId,
        score,
      },
    });
  }

  res.json({
    score,
    result: passed ? "Pass" : "Fail",
    passed,
    correct,
    total: qs.length,
    examTitle: attempt.exam.title,
    passScore: attempt.exam.passScore,
    credentialId: credentialId ?? null,
  });
});

function buildFallbackQuestions(examId: string, count: number) {
  return Array.from({ length: Math.min(count, 5) }, (_, i) => ({
    id: `fallback-${examId}-${i}`,
    examId,
    title: `Sample question ${i + 1}: Select the best answer for this certification item.`,
    type: "MULTIPLE_CHOICE" as const,
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctAnswer: "Option A",
    explanation: "",
    difficulty: "Intermediate",
    topic: "General",
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

export default router;
