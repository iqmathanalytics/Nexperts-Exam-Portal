import { Router } from "express";
import { ExamStatus, PaymentStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { formatExam } from "../lib/formatters.js";
import {
  formatScheduleForApi,
  getSchedulePhase,
} from "../services/exam-scheduling.js";

const router = Router();

async function examLevel(examId: string): Promise<string> {
  const qs = await prisma.question.findMany({
    where: { examId },
    select: { difficulty: true },
    take: 20,
  });
  if (!qs.length) return "Intermediate";
  const counts: Record<string, number> = {};
  for (const q of qs) counts[q.difficulty] = (counts[q.difficulty] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Intermediate";
}

router.get("/available-exams", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const owned = await prisma.payment.findMany({
    where: { userId, status: { in: [PaymentStatus.PAID, PaymentStatus.PENDING] } },
    select: { examId: true },
  });
  const excludeIds = owned.map((p) => p.examId);

  const exams = await prisma.exam.findMany({
    where: {
      status: ExamStatus.PUBLISHED,
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const withLevel = await Promise.all(
    exams.map(async (e) => ({
      ...formatExam(e),
      difficulty: await examLevel(e.id),
      attempts: e.maxAttempts,
    })),
  );

  res.json({ exams: withLevel });
});

router.get("/notifications", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const pendingPayments = await prisma.payment.findMany({
    where: { userId, status: PaymentStatus.PENDING },
    include: { exam: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const recentCerts = await prisma.certificate.findMany({
    where: { userId },
    include: { exam: true },
    orderBy: { issuedOn: "desc" },
    take: 5,
  });

  const notifications = [
    ...pendingPayments.map((p) => ({
      id: `pay-${p.id}`,
      type: "payment_pending" as const,
      title: "Complete your payment",
      message: `Finish checkout for ${p.exam.title} (MYR ${Number(p.amount)})`,
      createdAt: p.createdAt.toISOString(),
      paymentId: p.id,
      examId: p.examId,
      read: false,
    })),
    ...recentCerts.map((c) => ({
      id: `cert-${c.id}`,
      type: "certificate" as const,
      title: "Certificate earned",
      message: `You passed ${c.exam.title} with ${c.score}%`,
      createdAt: c.issuedOn.toISOString(),
      credentialId: c.credentialId,
      read: true,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ notifications, unreadCount: pendingPayments.length });
});

router.get("/my-exams", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;

  const payments = await prisma.payment.findMany({
    where: { userId, status: PaymentStatus.PAID },
    include: { exam: true },
    orderBy: { createdAt: "desc" },
  });

  const exams = await Promise.all(
    payments.map(async (p) => {
      const used = await prisma.examAttempt.count({
        where: { userId, examId: p.examId, result: { not: "IN_PROGRESS" } },
      });
      const inProgress = await prisma.examAttempt.findFirst({
        where: { userId, examId: p.examId, result: "IN_PROGRESS" },
      });
      const last = await prisma.examAttempt.findFirst({
        where: { userId, examId: p.examId, result: { not: "IN_PROGRESS" } },
        orderBy: { startedAt: "desc" },
      });
      const schedulePhase = getSchedulePhase(p.scheduledStartAt, p.scheduledEndAt, {
        hasInProgress: !!inProgress,
        attemptsExhausted: used >= p.exam.maxAttempts,
      });
      const schedule =
        p.scheduledStartAt && p.scheduledEndAt
          ? formatScheduleForApi(p.scheduledStartAt, p.scheduledEndAt)
          : null;
      return {
        id: p.exam.id,
        paymentId: p.id,
        title: p.exam.title,
        category: p.exam.category,
        description: p.exam.description,
        price: Number(p.exam.price),
        duration: p.exam.duration,
        questions: p.exam.questions,
        difficulty: "Intermediate",
        attempts: p.exam.maxAttempts,
        passScore: p.exam.passScore,
        proctoring: p.exam.proctoring,
        webcam: p.exam.webcam,
        used,
        inProgressAttemptId: inProgress?.id ?? null,
        schedulePhase,
        schedule,
        lastResult: last?.result,
        lastScore: last?.score ?? undefined,
        purchasedAt: p.createdAt.toISOString().slice(0, 10),
      };
    }),
  );

  res.json({ exams });
});

router.get("/exams/:examId/schedule", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const examId = String(req.params.examId);

  const payment = await prisma.payment.findFirst({
    where: { userId, examId, status: PaymentStatus.PAID },
    include: { exam: true },
    orderBy: { createdAt: "desc" },
  });
  if (!payment?.scheduledStartAt || !payment.scheduledEndAt) {
    return res.status(404).json({ error: "No schedule found for this exam" });
  }

  const inProgress = await prisma.examAttempt.findFirst({
    where: { userId, examId, result: "IN_PROGRESS" },
  });
  const used = await prisma.examAttempt.count({
    where: { userId, examId, result: { not: "IN_PROGRESS" } },
  });

  const now = new Date();
  const phase = getSchedulePhase(payment.scheduledStartAt, payment.scheduledEndAt, {
    hasInProgress: !!inProgress,
    attemptsExhausted: used >= payment.exam.maxAttempts,
  });
  const joinFrom = new Date(payment.scheduledStartAt.getTime() - 10 * 60 * 1000);
  const msUntilJoin = Math.max(0, joinFrom.getTime() - now.getTime());
  const msUntilStart = Math.max(0, payment.scheduledStartAt.getTime() - now.getTime());

  res.json({
    examId,
    examTitle: payment.exam.title,
    phase,
    canJoinWaiting: phase === "waiting" || phase === "ready" || phase === "in_progress",
    canStart: phase === "ready" || phase === "in_progress",
    inProgressAttemptId: inProgress?.id ?? null,
    msUntilJoin,
    msUntilStart,
    ...formatScheduleForApi(payment.scheduledStartAt, payment.scheduledEndAt),
  });
});

router.get("/certificates", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  const certs = await prisma.certificate.findMany({
    where: { userId: req.user!.sub },
    include: { exam: true },
    orderBy: { issuedOn: "desc" },
  });
  res.json({
    certificates: certs.map((c) => ({
      id: c.id,
      examTitle: c.exam.title,
      issuedOn: c.issuedOn.toISOString().slice(0, 10),
      score: c.score,
      credentialId: c.credentialId,
      shareUrl: `/certificate/${c.credentialId}`,
    })),
  });
});

router.get("/attempts", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  const attempts = await prisma.examAttempt.findMany({
    where: { userId: req.user!.sub, result: { not: "IN_PROGRESS" } },
    include: { exam: true },
    orderBy: { startedAt: "desc" },
  });
  res.json({
    attempts: attempts.map((a) => ({
      id: a.id,
      examTitle: a.exam.title,
      startedAt: a.startedAt.toISOString(),
      endedAt: a.endedAt?.toISOString() ?? null,
      duration: a.endedAt
        ? `${Math.round((a.endedAt.getTime() - a.startedAt.getTime()) / 60000)} min`
        : "—",
      score: a.score ?? 0,
      result: a.result === "PASS" ? "Pass" : "Fail",
    })),
  });
});

router.get("/dashboard", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  const [purchased, certificates, attempts, passed, totalAttempts] = await Promise.all([
    prisma.payment.count({ where: { userId, status: PaymentStatus.PAID } }),
    prisma.certificate.count({ where: { userId } }),
    prisma.examAttempt.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 5,
      include: { exam: true },
    }),
    prisma.examAttempt.count({ where: { userId, result: "PASS" } }),
    prisma.examAttempt.count({ where: { userId } }),
  ]);

  const passRate = totalAttempts ? Math.round((passed / totalAttempts) * 100) : 0;

  res.json({
    user: user
      ? {
          name: user.fullName,
          email: user.email,
          phone: user.phone,
          mycat: user.mycat,
        }
      : null,
    stats: {
      examsPurchased: purchased,
      certificates,
      passRate: `${passRate}%`,
    },
    recentAttempts: attempts.map((a) => ({
      id: a.id,
      examTitle: a.exam.title,
      startedAt: a.startedAt.toISOString(),
      score: a.score ?? 0,
      duration: a.endedAt
        ? `${Math.round((a.endedAt.getTime() - a.startedAt.getTime()) / 60000)} min`
        : "—",
      result: a.result === "PASS" ? "Pass" : a.result === "FAIL" ? "Fail" : "Fail",
    })),
  });
});

export default router;
