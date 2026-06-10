import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { Prisma, ExamStatus, PaymentStatus, Role, UserStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import {
  formatExam,
  formatQuestion,
  examStatusFromUi,
  questionTypeFromUi,
  questionTypeToUi,
} from "../lib/formatters.js";
import { env } from "../lib/env.js";
import { generateQuestionsWithGroq } from "../services/groq.js";
import { generateVoucherCode } from "../lib/voucher-code.js";
import { extractTextFromPdfBuffer } from "../services/pdf-text.js";
import { attendByFromPurchase } from "../services/exam-scheduling.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

const router = Router();
const adminOnly = requireAuth(Role.ADMIN, Role.SUPER_ADMIN);
router.use(adminOnly);

const examBodySchema = z.object({
  title: z.string().min(2),
  category: z.string().min(1),
  description: z.string(),
  duration: z.number().int().positive(),
  questions: z.number().int().positive(),
  passScore: z.number().int().min(0).max(100),
  maxAttempts: z.number().int().positive(),
  price: z.number().min(0),
  startDate: z.string().optional(),
  status: z.string(),
  proctoring: z.boolean(),
  fullscreen: z.boolean(),
  tabDetection: z.boolean(),
  webcam: z.boolean(),
  questionPoolId: z.string().nullable().optional(),
});

const questionBodySchema = z.object({
  examId: z.string().optional().nullable(),
  title: z.string().min(5),
  code: z.string().optional().nullable(),
  type: z.string(),
  options: z.array(z.string()).min(2),
  correctAnswer: z.string(),
  explanation: z.string().optional(),
  difficulty: z.string(),
  topic: z.string(),
  tags: z.array(z.string()).optional(),
  imageUrl: z.string().optional().nullable(),
});

/** Bulk / pool CSV rows may use shorter titles. */
const poolImportQuestionSchema = questionBodySchema.extend({
  title: z.string().min(1),
});

function zodErrorMessage(err: z.ZodError) {
  const first = err.errors[0];
  if (!first) return "Invalid request data";
  const path = first.path.length ? `${first.path.join(".")}: ` : "";
  return `${path}${first.message}`;
}

function parseDate(s?: string) {
  return s ? new Date(s) : null;
}

// ——— Dashboard ———
router.get("/stats", async (_req, res) => {
  const [totalUsers, activeExams, payments, passed, failed, ongoing, violations, voucherUsage] =
    await Promise.all([
      prisma.user.count({ where: { role: "CANDIDATE" } }),
      prisma.exam.count({ where: { status: "PUBLISHED" } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
      prisma.examAttempt.count({ where: { result: "PASS" } }),
      prisma.examAttempt.count({ where: { result: "FAIL" } }),
      prisma.examAttempt.count({ where: { result: "IN_PROGRESS" } }),
      prisma.proctoringViolation.count(),
      prisma.voucher.aggregate({ _sum: { usedCount: true } }),
    ]);

  const totalVoucherLimit = await prisma.voucher.aggregate({ _sum: { usageLimit: true } });
  const used = voucherUsage._sum.usedCount ?? 0;
  const limit = totalVoucherLimit._sum.usageLimit ?? 1;

  res.json({
    totalUsers,
    activeExams,
    revenue: Number(payments._sum.amount ?? 0),
    passed,
    failed,
    ongoing,
    violations,
    voucherUsage: Math.round((used / limit) * 100) || 0,
  });
});

router.get("/charts", async (_req, res) => {
  const payments = await prisma.payment.findMany({
    where: { status: "PAID" },
    orderBy: { createdAt: "asc" },
  });
  const byMonth: Record<string, number> = {};
  for (const p of payments) {
    const m = p.createdAt.toLocaleString("en", { month: "short" });
    byMonth[m] = (byMonth[m] ?? 0) + Number(p.amount);
  }
  const revenueChartData = Object.entries(byMonth).map(([month, revenue]) => ({ month, revenue }));

  const attempts = await prisma.examAttempt.findMany({
    where: { startedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
  });
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const examActivityData = days.map((day, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label = days[d.getDay()];
    const count = attempts.filter(
      (a) => a.startedAt.toDateString() === d.toDateString(),
    ).length;
    return { day: label, attempts: count };
  });

  res.json({ revenueChartData, examActivityData });
});

const adminNotificationsLastRead = new Map<string, number>();

router.get("/notifications", async (req, res) => {
  const adminId = (req as AuthedRequest).user!.sub;
  const lastRead = adminNotificationsLastRead.get(adminId) ?? 0;

  const [pendingPayments, recentViolations, flaggedAttempts, recentUsers] = await Promise.all([
    prisma.payment.findMany({
      where: { status: PaymentStatus.PENDING },
      include: { user: true, exam: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.proctoringViolation.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: true, attempt: { include: { exam: true } } },
    }),
    prisma.examAttempt.findMany({
      where: { result: "IN_PROGRESS", warnings: { gte: 3 } },
      include: { user: true, exam: true },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    prisma.user.findMany({
      where: {
        role: Role.CANDIDATE,
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const notifications = [
    ...pendingPayments.map((p) => ({
      id: `pending-${p.id}`,
      type: "info",
      title: "Pending payment",
      message: `${p.user.fullName} — ${p.exam.title} (MYR ${Number(p.amount)})`,
      createdAt: p.createdAt.toISOString(),
      read: p.createdAt.getTime() <= lastRead,
    })),
    ...recentViolations.map((v) => ({
      id: `violation-${v.id}`,
      type: "alert",
      title: "Proctoring violation",
      message: `${v.user.fullName} — ${v.type} during ${v.attempt.exam.title}`,
      createdAt: v.createdAt.toISOString(),
      read: v.createdAt.getTime() <= lastRead,
    })),
    ...flaggedAttempts.map((a) => ({
      id: `flagged-${a.id}`,
      type: "alert",
      title: "Flagged exam session",
      message: `${a.user.fullName} has ${a.warnings} warnings on ${a.exam.title}`,
      createdAt: a.startedAt.toISOString(),
      read: a.startedAt.getTime() <= lastRead,
    })),
    ...recentUsers.map((u) => ({
      id: `user-${u.id}`,
      type: "info",
      title: "New candidate registered",
      message: `${u.fullName} (${u.email}) joined the portal`,
      createdAt: u.createdAt.toISOString(),
      read: u.createdAt.getTime() <= lastRead,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 25);

  res.json({
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
  });
});

router.post("/notifications/mark-read", async (req, res) => {
  const adminId = (req as AuthedRequest).user!.sub;
  adminNotificationsLastRead.set(adminId, Date.now());
  res.json({ ok: true });
});

// ——— Exams ———
router.get("/exams", async (_req, res) => {
  const exams = await prisma.exam.findMany({
    include: { questionPool: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json({
    exams: exams.map((exam) => ({
      ...formatExam(exam),
      questionPoolName: exam.questionPool?.name ?? null,
    })),
  });
});

router.post("/exams/assign", async (req, res) => {
  try {
    const { userId, examId, startImmediately } = z
      .object({
        userId: z.string().min(1),
        examId: z.string().min(1),
        startImmediately: z.boolean().optional(),
      })
      .parse(req.body);

    const [user, exam] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.exam.findUnique({ where: { id: examId } }),
    ]);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== Role.CANDIDATE) {
      return res.status(400).json({ error: "Exams can only be assigned to candidates" });
    }
    if (!exam) return res.status(404).json({ error: "Exam not found" });

    const existingPaid = await prisma.payment.findFirst({
      where: { userId, examId, status: PaymentStatus.PAID },
    });
    if (existingPaid) {
      return res.status(409).json({ error: "User already has access to this exam" });
    }

    await prisma.payment.deleteMany({
      where: { userId, examId, status: PaymentStatus.PENDING },
    });

    const now = new Date();
    const openNow = startImmediately !== false;
    const scheduledStartAt = openNow ? now : null;
    const scheduledEndAt = openNow
      ? new Date(now.getTime() + exam.duration * 60 * 1000)
      : null;
    const inv = `INV-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const payment = await prisma.payment.create({
      data: {
        userId,
        examId,
        amount: 0,
        status: PaymentStatus.PAID,
        invoiceId: inv,
        attendByAt: attendByFromPurchase(now),
        scheduledStartAt,
        scheduledEndAt,
      },
      include: { exam: true, user: true },
    });

    res.json({
      ok: true,
      payment: {
        id: payment.id,
        userId: payment.userId,
        examId: payment.examId,
        candidate: payment.user.fullName,
        exam: payment.exam.title,
        startImmediately: openNow,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.flatten() });
    console.error("Assign exam error:", e);
    return res.status(500).json({ error: "Could not assign exam" });
  }
});

router.get("/exams/:id", async (req, res) => {
  const exam = await prisma.exam.findUnique({
    where: { id: String(req.params.id) },
    include: { questionPool: { select: { id: true, name: true } } },
  });
  if (!exam) return res.status(404).json({ error: "Exam not found" });
  res.json({
    exam: {
      ...formatExam(exam),
      questionPoolName: exam.questionPool?.name ?? null,
    },
  });
});

router.post("/exams", async (req, res) => {
  try {
    const body = examBodySchema.parse(req.body);
    const exam = await prisma.exam.create({
      data: {
        title: body.title,
        category: body.category,
        description: body.description,
        duration: body.duration,
        questions: body.questions,
        passScore: body.passScore,
        maxAttempts: body.maxAttempts,
        price: body.price,
        startDate: parseDate(body.startDate),
        endDate: null,
        status: examStatusFromUi(body.status),
        proctoring: body.proctoring,
        fullscreen: body.fullscreen,
        tabDetection: body.tabDetection,
        webcam: body.webcam,
        questionPoolId: body.questionPoolId ?? null,
      },
    });
    res.status(201).json({ exam: formatExam(exam) });
  } catch {
    res.status(400).json({ error: "Invalid exam data" });
  }
});

router.put("/exams/:id", async (req, res) => {
  try {
    const body = examBodySchema.parse(req.body);
    const exam = await prisma.exam.update({
      where: { id: String(req.params.id) },
      data: {
        title: body.title,
        category: body.category,
        description: body.description,
        duration: body.duration,
        questions: body.questions,
        passScore: body.passScore,
        maxAttempts: body.maxAttempts,
        price: body.price,
        startDate: parseDate(body.startDate),
        endDate: null,
        status: examStatusFromUi(body.status),
        proctoring: body.proctoring,
        fullscreen: body.fullscreen,
        tabDetection: body.tabDetection,
        webcam: body.webcam,
        questionPoolId: body.questionPoolId ?? null,
      },
    });
    res.json({ exam: formatExam(exam) });
  } catch {
    res.status(400).json({ error: "Invalid exam data" });
  }
});

router.patch("/exams/:id/status", async (req, res) => {
  const { status } = z.object({ status: z.string() }).parse(req.body);
  const exam = await prisma.exam.update({
    where: { id: String(req.params.id) },
    data: { status: examStatusFromUi(status) },
  });
  res.json({ exam: formatExam(exam) });
});

router.post("/exams/:id/duplicate", async (req, res) => {
  const src = await prisma.exam.findUnique({ where: { id: String(req.params.id) } });
  if (!src) return res.status(404).json({ error: "Exam not found" });
  const exam = await prisma.exam.create({
    data: {
      title: `${src.title} (Copy)`,
      category: src.category,
      description: src.description,
      duration: src.duration,
      questions: src.questions,
      passScore: src.passScore,
      maxAttempts: src.maxAttempts,
      price: src.price,
      startDate: src.startDate,
      endDate: null,
      status: ExamStatus.DRAFT,
      proctoring: src.proctoring,
      fullscreen: src.fullscreen,
      tabDetection: src.tabDetection,
      webcam: src.webcam,
    },
  });
  res.status(201).json({ exam: formatExam(exam) });
});

router.delete("/exams/:id", async (req, res) => {
  const id = String(req.params.id);
  try {
    const exam = await prisma.exam.findUnique({ where: { id }, select: { id: true } });
    if (!exam) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }

    const [paidPayments, certificates] = await Promise.all([
      prisma.payment.count({ where: { examId: id, status: PaymentStatus.PAID } }),
      prisma.certificate.count({ where: { examId: id } }),
    ]);

    if (paidPayments > 0) {
      res.status(409).json({
        error: "Cannot delete an exam with paid purchases. Unpublish or archive it instead.",
      });
      return;
    }

    if (certificates > 0) {
      res.status(409).json({
        error: "Cannot delete an exam with issued certificates. Archive it instead.",
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.examAttempt.deleteMany({ where: { examId: id } });
      await tx.payment.deleteMany({ where: { examId: id } });
      await tx.question.updateMany({ where: { examId: id }, data: { examId: null } });
      await tx.exam.delete({ where: { id } });
    });

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      res.status(409).json({ error: "Cannot delete this exam because related records still exist." });
      return;
    }
    console.error("DELETE /exams/:id failed:", err);
    res.status(500).json({ error: "Could not delete exam" });
  }
});

// ——— Questions ———
router.get("/questions/topics", async (req, res) => {
  const examId = typeof req.query.examId === "string" ? req.query.examId : undefined;
  const questions = await prisma.question.findMany({
    where: examId ? { examId } : { examId: { not: null } },
    select: { topic: true },
  });
  const topics = [...new Set(questions.map((q) => q.topic).filter((t) => t?.trim()))].sort((a, b) =>
    a.localeCompare(b),
  );
  res.json({ topics });
});

router.get("/questions/assignable", async (req, res) => {
  const examId = typeof req.query.examId === "string" ? req.query.examId : undefined;
  if (!examId) {
    res.status(400).json({ error: "examId is required" });
    return;
  }
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }
  const questions = await prisma.question.findMany({
    where: {
      OR: [{ examId: null }, { examId: { not: examId } }],
    },
    include: { exam: { select: { id: true, title: true } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json({
    questions: questions.map((q) => ({
      ...formatQuestion(q),
      examTitle: q.exam?.title ?? null,
    })),
  });
});

router.post("/questions/assign", async (req, res) => {
  try {
    const body = z
      .object({
        examId: z.string().min(1),
        questionIds: z.array(z.string().min(1)).min(1),
      })
      .parse(req.body);
    const exam = await prisma.exam.findUnique({ where: { id: body.examId } });
    if (!exam) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }
    const result = await prisma.question.updateMany({
      where: { id: { in: body.questionIds } },
      data: { examId: body.examId },
    });
    res.json({ count: result.count, examId: body.examId });
  } catch {
    res.status(400).json({ error: "Invalid assign request" });
  }
});

function parseQuestionListQuery(req: { query: Record<string, unknown> }) {
  const examId = typeof req.query.examId === "string" ? req.query.examId : undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const type = typeof req.query.type === "string" && req.query.type !== "all" ? req.query.type : undefined;
  const topic = typeof req.query.topic === "string" && req.query.topic !== "all" ? req.query.topic : undefined;
  const difficulty =
    typeof req.query.difficulty === "string" && req.query.difficulty !== "all" ? req.query.difficulty : undefined;
  const all = req.query.all === "1" || req.query.all === "true";
  const limit = all
    ? 10_000
    : Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const offset = all ? 0 : Math.max(Number(req.query.offset) || 0, 0);
  return { examId, search, type, topic, difficulty, limit, offset, all };
}

function buildQuestionListWhere(params: {
  examId?: string;
  search?: string;
  type?: string;
  topic?: string;
  difficulty?: string;
}): Prisma.QuestionWhereInput {
  const where: Prisma.QuestionWhereInput = {};
  if (params.examId === "unassigned") where.examId = null;
  else if (params.examId) where.examId = params.examId;
  if (params.type) where.type = questionTypeFromUi(params.type);
  if (params.topic) where.topic = params.topic;
  if (params.difficulty) where.difficulty = params.difficulty;
  if (params.search) {
    where.OR = [
      { title: { contains: params.search } },
      { topic: { contains: params.search } },
    ];
  }
  return where;
}

router.get("/questions/filter-options", async (req, res) => {
  const examId = typeof req.query.examId === "string" ? req.query.examId : undefined;
  const where = buildQuestionListWhere({ examId });
  const [topicRows, typeRows, difficultyRows] = await Promise.all([
    prisma.question.findMany({
      where,
      select: { topic: true },
      distinct: ["topic"],
      orderBy: { topic: "asc" },
    }),
    prisma.question.findMany({
      where,
      select: { type: true },
      distinct: ["type"],
    }),
    prisma.question.findMany({
      where,
      select: { difficulty: true },
      distinct: ["difficulty"],
      orderBy: { difficulty: "asc" },
    }),
  ]);
  res.json({
    topics: topicRows.map((r) => r.topic).filter((t) => t?.trim()),
    types: [...new Set(typeRows.map((r) => questionTypeToUi(r.type)))].sort((a, b) => a.localeCompare(b)),
    difficulties: difficultyRows.map((r) => r.difficulty).filter(Boolean),
  });
});

router.get("/questions", async (req, res) => {
  const { examId, search, type, topic, difficulty, limit, offset } = parseQuestionListQuery(req);
  const where = buildQuestionListWhere({ examId, search, type, topic, difficulty });
  const [total, rows] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      include: { exam: { select: { id: true, title: true } } },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);
  res.json({
    questions: rows.map((q) => ({
      ...formatQuestion(q),
      examTitle: q.exam?.title ?? null,
    })),
    total,
    hasMore: offset + rows.length < total,
  });
});

router.post("/questions", async (req, res) => {
  try {
    const body = questionBodySchema.parse(req.body);
    const q = await prisma.question.create({
      data: {
        examId: body.examId || null,
        title: body.title,
        code: body.code?.trim() || null,
        type: questionTypeFromUi(body.type),
        options: body.options,
        correctAnswer: body.correctAnswer,
        explanation: body.explanation,
        difficulty: body.difficulty,
        topic: body.topic,
        tags: body.tags ?? [],
        imageUrl: body.imageUrl || null,
      },
    });
    res.status(201).json({ question: formatQuestion(q) });
  } catch {
    res.status(400).json({ error: "Invalid question data" });
  }
});

router.put("/questions/:id", async (req, res) => {
  try {
    const body = questionBodySchema.parse(req.body);
    const q = await prisma.question.update({
      where: { id: String(req.params.id) },
      data: {
        examId: body.examId || null,
        title: body.title,
        code: body.code?.trim() || null,
        type: questionTypeFromUi(body.type),
        options: body.options,
        correctAnswer: body.correctAnswer,
        explanation: body.explanation,
        difficulty: body.difficulty,
        topic: body.topic,
        tags: body.tags ?? [],
        imageUrl: body.imageUrl || null,
      },
    });
    res.json({ question: formatQuestion(q) });
  } catch {
    res.status(400).json({ error: "Invalid question data" });
  }
});

router.delete("/questions/:id", async (req, res) => {
  await prisma.question.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

router.post("/questions/bulk-delete", async (req, res) => {
  try {
    const { questionIds } = z
      .object({ questionIds: z.array(z.string()).min(1).max(1000) })
      .parse(req.body);
    const result = await prisma.question.deleteMany({
      where: { id: { in: questionIds } },
    });
    res.json({ count: result.count });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: zodErrorMessage(err) });
    }
    console.error("POST /questions/bulk-delete failed:", err);
    res.status(500).json({ error: "Could not delete questions" });
  }
});

router.post("/questions/bulk", async (req, res) => {
  const items = z.array(questionBodySchema).parse(req.body.questions ?? req.body);
  const created = await prisma.$transaction(
    items.map((body) =>
      prisma.question.create({
        data: {
          examId: body.examId || null,
          title: body.title,
          code: body.code?.trim() || null,
          type: questionTypeFromUi(body.type),
          options: body.options,
          correctAnswer: body.correctAnswer,
          explanation: body.explanation,
          difficulty: body.difficulty,
          topic: body.topic,
          tags: body.tags ?? [],
          imageUrl: body.imageUrl || null,
        },
      }),
    ),
  );
  res.status(201).json({ count: created.length, questions: created.map(formatQuestion) });
});

// ——— Question pools ———
router.get("/question-pools", async (_req, res) => {
  const pools = await prisma.questionPool.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json({
    pools: pools.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      active: p.active,
      questionCount: p._count.items,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
});

router.get("/question-pools/:id", async (req, res) => {
  const pool = await prisma.questionPool.findUnique({
    where: { id: String(req.params.id) },
    include: {
      items: {
        include: { question: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!pool) return res.status(404).json({ error: "Question pool not found" });
  res.json({
    pool: {
      id: pool.id,
      name: pool.name,
      description: pool.description ?? "",
      active: pool.active,
      questionCount: pool.items.length,
      questions: pool.items.map((it) => formatQuestion(it.question)),
    },
  });
});

const QUESTION_IMPORT_BATCH = 100;

function questionCreateData(body: z.infer<typeof poolImportQuestionSchema>) {
  return {
    examId: body.examId || null,
    title: body.title.trim(),
    code: body.code?.trim() || null,
    type: questionTypeFromUi(body.type),
    options: body.options,
    correctAnswer: body.correctAnswer,
    explanation: body.explanation ?? "",
    difficulty: body.difficulty,
    topic: body.topic,
    tags: body.tags ?? ["pool-import"],
    imageUrl: body.imageUrl || null,
  };
}

async function createQuestionsForPool(newQuestions: z.infer<typeof poolImportQuestionSchema>[]) {
  if (!newQuestions.length) return [] as string[];
  const ids: string[] = [];
  for (let i = 0; i < newQuestions.length; i += QUESTION_IMPORT_BATCH) {
    const batch = newQuestions.slice(i, i + QUESTION_IMPORT_BATCH);
    const created = await Promise.all(
      batch.map((body) => prisma.question.create({ data: questionCreateData(body) })),
    );
    ids.push(...created.map((q) => q.id));
  }
  return ids;
}

async function syncPoolQuestionIds(poolId: string, questionIds: string[]) {
  const existing = await prisma.questionPoolItem.findMany({
    where: { poolId },
    select: { questionId: true },
  });
  const existingSet = new Set(existing.map((row) => row.questionId));
  const targetSet = new Set(questionIds);
  const toAdd = questionIds.filter((id) => !existingSet.has(id));
  const toRemove = [...existingSet].filter((id) => !targetSet.has(id));

  if (toRemove.length) {
    await prisma.questionPoolItem.deleteMany({
      where: { poolId, questionId: { in: toRemove } },
    });
  }
  if (toAdd.length) {
    await prisma.questionPoolItem.createMany({
      data: toAdd.map((questionId) => ({ poolId, questionId })),
      skipDuplicates: true,
    });
  }
}

router.post("/question-pools", async (req, res) => {
  try {
    const body = z
      .object({
        name: z.string().min(2),
        description: z.string().optional(),
        active: z.boolean().optional().default(true),
        questionIds: z.array(z.string()).optional().default([]),
        newQuestions: z.array(poolImportQuestionSchema).optional().default([]),
      })
      .parse(req.body);

    const importedIds = await createQuestionsForPool(body.newQuestions);
    const allQuestionIds = [...new Set([...body.questionIds, ...importedIds])];

    if (allQuestionIds.length === 0) {
      return res.status(400).json({ error: "Add questions by selection or bulk CSV import" });
    }

    const pool = await prisma.questionPool.create({
      data: {
        name: body.name,
        description: body.description ?? "",
        active: body.active,
      },
    });
    await syncPoolQuestionIds(pool.id, allQuestionIds);

    res.status(201).json({
      pool: {
        id: pool.id,
        name: pool.name,
        description: pool.description ?? "",
        active: pool.active,
        questionCount: allQuestionIds.length,
      },
      importedCount: importedIds.length,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: zodErrorMessage(err) });
    }
    console.error("POST /question-pools failed:", err);
    const message = err instanceof Error ? err.message : "Could not create question pool";
    res.status(500).json({
      error: message.includes("Unknown argument `code`")
        ? "Database schema is out of date. Run: npx prisma db push && npx prisma generate, then restart the API."
        : "Could not create question pool",
    });
  }
});

router.put("/question-pools/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const body = z
      .object({
        name: z.string().min(2),
        description: z.string().optional(),
        active: z.boolean().optional().default(true),
        questionIds: z.array(z.string()).optional().default([]),
        newQuestions: z.array(poolImportQuestionSchema).optional().default([]),
      })
      .parse(req.body);

    const pool = await prisma.questionPool.findUnique({ where: { id } });
    if (!pool) return res.status(404).json({ error: "Question pool not found" });

    const importedIds = await createQuestionsForPool(body.newQuestions);
    const allQuestionIds = [...new Set([...body.questionIds, ...importedIds])];

    if (allQuestionIds.length === 0) {
      return res.status(400).json({ error: "Add questions by selection or bulk CSV import" });
    }

    await prisma.questionPool.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description ?? "",
        active: body.active,
      },
    });
    await syncPoolQuestionIds(id, allQuestionIds);

    const updated = await prisma.questionPool.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
    res.json({
      pool: {
        id: updated!.id,
        name: updated!.name,
        description: updated!.description ?? "",
        active: updated!.active,
        questionCount: updated!._count.items,
      },
      importedCount: importedIds.length,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: zodErrorMessage(err) });
    }
    console.error("PUT /question-pools failed:", err);
    res.status(500).json({ error: "Could not update question pool" });
  }
});

router.delete("/question-pools/:id", async (req, res) => {
  await prisma.questionPool.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

// ——— AI (Groq) ———
router.post("/ai/generate", async (req, res) => {
  try {
    const body = z
      .object({
        topic: z.string().min(3),
        count: z.coerce.number().int().min(1).max(50),
        difficulty: z.string().min(1),
        questionType: z.string().min(1),
        examId: z.string().optional(),
        saveToBank: z.coerce.boolean().optional().default(false),
        sourceMaterial: z.string().optional(),
      })
      .parse(req.body);

    const result = await generateQuestionsWithGroq({
      topic: body.topic,
      count: body.count,
      difficulty: body.difficulty,
      questionType: body.questionType,
      sourceMaterial: body.sourceMaterial,
    });

    let savedCount = 0;
    let savedQuestions: ReturnType<typeof formatQuestion>[] = [];

    if (body.saveToBank && body.examId) {
      const exam = await prisma.exam.findUnique({ where: { id: body.examId } });
      if (!exam) {
        return res.status(404).json({ error: "Exam not found" });
      }
      const created = await prisma.$transaction(
        result.questions.map((q) =>
          prisma.question.create({
            data: {
              examId: body.examId!,
              title: q.title,
              type: questionTypeFromUi(q.type),
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              difficulty: q.difficulty,
              topic: q.topic,
              tags: q.tags ?? ["ai-generated"],
            },
          }),
        ),
      );
      savedCount = created.length;
      savedQuestions = created.map((q) => {
        const formatted = formatQuestion(q);
        return { ...formatted, examTitle: exam.title };
      });
    }

    const previewQuestions =
      savedCount > 0
        ? savedQuestions
        : result.questions.map((q, i) => ({
            id: `gen-${Date.now()}-${i}`,
            ...q,
          }));

    res.json({
      source: result.source,
      fallbackReason: result.fallbackReason,
      groqConfigured: Boolean(env.groqApiKey?.trim()),
      saved: savedCount > 0,
      savedCount,
      examId: body.examId ?? null,
      questions: previewQuestions,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.flatten() });
    res.status(500).json({ error: "AI generation failed" });
  }
});

// ——— Voucher batches ———
router.get("/voucher-batches", async (_req, res) => {
  const batches = await prisma.voucherBatch.findMany({
    include: {
      vouchers: {
        include: { redemptions: { select: { id: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    batches: batches.map((b) => {
      const used = b.vouchers.filter((v) => v.usedCount > 0).length;
      const totalUses = b.vouchers.reduce((sum, v) => sum + v.usedCount, 0);
      const totalUsageLimit = b.vouchers.reduce((sum, v) => sum + v.usageLimit, 0);
      return {
        id: b.id,
        label: b.label ?? `Batch ${b.createdAt.toISOString().slice(0, 10)}`,
        discountType: b.discountType,
        discountAmount: Number(b.discountAmount),
        expiry: b.expiry.toISOString().slice(0, 10),
        active: b.active,
        quantity: b.quantity,
        usedCount: used,
        availableCount: b.vouchers.length - used,
        totalUses,
        totalUsageLimit,
        usageLimitPerVoucher: b.vouchers[0]?.usageLimit ?? 1,
        createdAt: b.createdAt.toISOString(),
      };
    }),
  });
});

router.get("/voucher-batches/:id", async (req, res) => {
  const batch = await prisma.voucherBatch.findUnique({
    where: { id: String(req.params.id) },
    include: {
      vouchers: {
        include: {
          redemptions: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { code: "asc" },
      },
    },
  });
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  res.json({
    batch: {
      id: batch.id,
      label: batch.label,
      discountType: batch.discountType,
      discountAmount: Number(batch.discountAmount),
      expiry: batch.expiry.toISOString().slice(0, 10),
      active: batch.active,
      quantity: batch.quantity,
      usageLimitPerVoucher: batch.vouchers[0]?.usageLimit ?? 1,
      vouchers: batch.vouchers.map((v) => ({
        id: v.id,
        code: v.code,
        used: v.usedCount > 0,
        usedCount: v.usedCount,
        usageLimit: v.usageLimit,
        active: v.active,
        redeemedAt: v.redemptions[0]?.createdAt?.toISOString() ?? null,
        redemptions: v.redemptions.map((r) => ({
          id: r.id,
          usedAt: r.createdAt.toISOString(),
          userId: r.userId,
          userName: r.user.fullName,
          userEmail: r.user.email,
        })),
      })),
    },
  });
});

router.post("/voucher-batches", async (req, res) => {
  const body = z
    .object({
      label: z.string().optional(),
      quantity: z.number().int().min(1).max(500),
      discountType: z.string(),
      discountAmount: z.number(),
      expiry: z.string(),
      usageLimitPerVoucher: z.number().int().min(1).max(100).optional().default(1),
      active: z.boolean().default(true),
      examIds: z.array(z.string()).optional(),
    })
    .parse(req.body);

  const codes = new Set<string>();
  while (codes.size < body.quantity) {
    codes.add(generateVoucherCode(32));
  }

  const batch = await prisma.voucherBatch.create({
    data: {
      label: body.label,
      discountType: body.discountType,
      discountAmount: body.discountAmount,
      expiry: new Date(body.expiry),
      active: body.active,
      quantity: body.quantity,
      vouchers: {
        create: [...codes].map((code) => ({
          code,
          discountType: body.discountType,
          discountAmount: body.discountAmount,
          usageLimit: body.usageLimitPerVoucher,
          expiry: new Date(body.expiry),
          active: body.active,
          exams: body.examIds?.length
            ? { create: body.examIds.map((examId) => ({ examId })) }
            : undefined,
        })),
      },
    },
    include: { vouchers: true },
  });

  res.status(201).json({ batchId: batch.id, quantity: batch.vouchers.length });
});

router.get("/voucher-batches/:id/csv", async (req, res) => {
  const batch = await prisma.voucherBatch.findUnique({
    where: { id: String(req.params.id) },
    include: { vouchers: { orderBy: { code: "asc" } } },
  });
  if (!batch) return res.status(404).json({ error: "Batch not found" });

  const lines = [
    "code,discount_type,discount_amount,expiry,used_count,usage_limit,status",
    ...batch.vouchers.map((v) => {
      const status = v.usedCount >= v.usageLimit ? "used_up" : v.active ? "available" : "inactive";
      return `${v.code},${v.discountType},${Number(v.discountAmount)},${v.expiry.toISOString().slice(0, 10)},${v.usedCount},${v.usageLimit},${status}`;
    }),
  ];
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="voucher-batch-${batch.id}.csv"`);
  res.send(lines.join("\n"));
});

router.patch("/voucher-batches/:id/toggle", async (req, res) => {
  const batch = await prisma.voucherBatch.findUnique({ where: { id: String(req.params.id) } });
  if (!batch) return res.status(404).json({ error: "Not found" });
  const active = !batch.active;
  await prisma.$transaction([
    prisma.voucherBatch.update({ where: { id: batch.id }, data: { active } }),
    prisma.voucher.updateMany({ where: { batchId: batch.id }, data: { active } }),
  ]);
  res.json({ active });
});

router.delete("/voucher-batches/:id", async (req, res) => {
  await prisma.voucherBatch.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

router.post("/ai/generate-from-pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "PDF file is required" });
    const text = await extractTextFromPdfBuffer(req.file.buffer);
    if (text.length < 80) {
      return res.status(400).json({ error: "Could not extract enough text from PDF" });
    }

    const fields = z
      .object({
        topic: z.string().optional(),
        count: z.coerce.number().int().min(1).max(50).default(5),
        difficulty: z.string().default("Intermediate"),
        questionType: z.string().default("Mixed"),
        examId: z.string().optional(),
        saveToBank: z.coerce.boolean().optional().default(false),
      })
      .parse(req.body);

    const topic = fields.topic?.trim() || "Content from uploaded PDF";
    const result = await generateQuestionsWithGroq({
      topic,
      count: fields.count,
      difficulty: fields.difficulty,
      questionType: fields.questionType,
      sourceMaterial: text,
    });

    let savedCount = 0;
    if (fields.saveToBank && fields.examId) {
      const exam = await prisma.exam.findUnique({ where: { id: fields.examId } });
      if (!exam) return res.status(404).json({ error: "Exam not found" });
      const created = await prisma.$transaction(
        result.questions.map((q) =>
          prisma.question.create({
            data: {
              examId: fields.examId!,
              title: q.title,
              type: questionTypeFromUi(q.type),
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              difficulty: q.difficulty,
              topic: q.topic,
              tags: q.tags ?? ["ai-generated", "pdf"],
            },
          }),
        ),
      );
      savedCount = created.length;
    }

    res.json({
      source: result.source,
      fallbackReason: result.fallbackReason,
      extractedChars: text.length,
      savedCount,
      questions: result.questions,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.flatten() });
    console.error("PDF generate error:", e);
    const detail = e instanceof Error ? e.message : "PDF question generation failed";
    res.status(500).json({
      error: "PDF question generation failed",
      ...(env.nodeEnv !== "production" ? { detail } : {}),
    });
  }
});

// ——— Users ———
router.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { role: "CANDIDATE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      icPassport: true,
      status: true,
      createdAt: true,
      _count: { select: { attempts: true, violations: true } },
    },
  });
  res.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.fullName,
      email: u.email,
      phone: u.phone,
      icPassport: u.icPassport,
      status: u.status,
      examsTaken: u._count.attempts,
      violations: u._count.violations,
      joined: u.createdAt.toISOString().slice(0, 10),
    })),
  });
});

router.get("/users/:id", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: String(req.params.id) },
    include: {
      attempts: { include: { exam: true }, orderBy: { startedAt: "desc" } },
      payments: { include: { exam: true }, orderBy: { createdAt: "desc" } },
      violations: { orderBy: { createdAt: "desc" }, take: 20 },
      certificates: { include: { exam: true } },
    },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    user: {
      id: user.id,
      name: user.fullName,
      email: user.email,
      phone: user.phone,
      icPassport: user.icPassport,
      status: user.status,
      joined: user.createdAt.toISOString().slice(0, 10),
    },
    attempts: user.attempts.map((a) => ({
      id: a.id,
      examId: a.examId,
      exam: a.exam.title,
      date: a.startedAt.toISOString().slice(0, 10),
      score: a.score ?? 0,
      result: a.result === "PASS" ? "Pass" : a.result === "FAIL" ? "Fail" : "In Progress",
    })),
    payments: user.payments.map((p) => ({
      id: p.id,
      exam: p.exam.title,
      amount: Number(p.amount),
      status: p.status,
      date: p.createdAt.toISOString().slice(0, 10),
    })),
    violations: user.violations.map((v) => ({
      type: v.type,
      detail: v.detail,
      date: v.createdAt.toISOString().slice(0, 10),
    })),
    certificates: user.certificates.map((c) => ({
      exam: c.exam.title,
      credentialId: c.credentialId,
      score: c.score,
    })),
  });
});

router.post("/users/:id/reset-attempts", async (req, res) => {
  try {
    const userId = String(req.params.id);
    const { examId } = z.object({ examId: z.string().optional() }).parse(req.body ?? {});

    const where = { userId, ...(examId ? { examId } : {}) };
    const attempts = await prisma.examAttempt.findMany({ where, select: { id: true } });
    if (attempts.length === 0) {
      return res.json({ deleted: 0, message: "No attempts to reset" });
    }

    await prisma.examAttempt.deleteMany({ where });
    res.json({
      deleted: attempts.length,
      message: examId
        ? `Reset attempts for this exam (${attempts.length} removed)`
        : `Reset all exam attempts (${attempts.length} removed)`,
    });
  } catch {
    res.status(400).json({ error: "Could not reset attempts" });
  }
});

router.patch("/users/:id/status", async (req, res) => {
  const { status } = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) }).parse(req.body);
  const user = await prisma.user.update({
    where: { id: String(req.params.id) },
    data: { status: status as UserStatus },
  });
  res.json({ status: user.status });
});

router.get("/users/:id/report", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: String(req.params.id) },
    include: {
      attempts: { include: { exam: true }, orderBy: { startedAt: "desc" } },
      payments: { include: { exam: true }, orderBy: { createdAt: "desc" } },
      violations: { orderBy: { createdAt: "desc" } },
      certificates: { include: { exam: true } },
    },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  const lines = [
    "Section,Field,Value",
    `Profile,Name,${user.fullName}`,
    `Profile,Email,${user.email}`,
    `Profile,Phone,${user.phone ?? ""}`,
    `Profile,IC/Passport,${user.icPassport ?? ""}`,
    `Profile,Status,${user.status}`,
    `Profile,Joined,${user.createdAt.toISOString().slice(0, 10)}`,
    "",
    "Exam Attempts,Exam,Score,Result,Date",
    ...user.attempts.map(
      (a) => `Attempt,${a.exam.title},${a.score ?? 0},${a.result},${a.startedAt.toISOString().slice(0, 10)}`,
    ),
    "",
    "Payments,Exam,Amount,Status,Date",
    ...user.payments.map(
      (p) => `Payment,${p.exam.title},${p.amount},${p.status},${p.createdAt.toISOString().slice(0, 10)}`,
    ),
    "",
    "Violations,Type,Detail,Date",
    ...user.violations.map(
      (v) => `Violation,${v.type},${v.detail ?? ""},${v.createdAt.toISOString()}`,
    ),
    "",
    "Certificates,Exam,Credential,Score",
    ...user.certificates.map((c) => `Certificate,${c.exam.title},${c.credentialId},${c.score}`),
  ];
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="user-${user.fullName.replace(/\s+/g, "-")}-report.csv"`,
  );
  res.send(lines.join("\n"));
});

// ——— Payments, results, monitoring, certificates ———
router.get("/payments", async (_req, res) => {
  const payments = await prisma.payment.findMany({
    include: { user: true, exam: true, voucher: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({
    payments: payments.map((p) => ({
      id: p.id,
      user: p.user.fullName,
      exam: p.exam.title,
      amount: Number(p.amount),
      voucher: p.voucher?.code,
      status: p.status,
      invoiceId: p.invoiceId,
      date: p.createdAt.toISOString().slice(0, 10),
    })),
  });
});

router.patch("/payments/:id/refund", async (req, res) => {
  const payment = await prisma.payment.update({
    where: { id: String(req.params.id) },
    data: { status: PaymentStatus.REFUNDED },
  });
  res.json({ status: payment.status });
});

router.get("/results", async (req, res) => {
  const examId = typeof req.query.examId === "string" ? req.query.examId : undefined;
  const attempts = await prisma.examAttempt.findMany({
    where: {
      result: { not: "IN_PROGRESS" },
      ...(examId ? { examId } : {}),
    },
    include: { user: true, exam: true },
    orderBy: { startedAt: "desc" },
    take: 100,
  });
  res.json({
    results: attempts.map((a) => ({
      id: a.id,
      candidate: a.user.fullName,
      exam: a.exam.title,
      score: a.score ?? 0,
      result: a.result === "PASS" ? "Pass" : "Fail",
      date: a.startedAt.toISOString().slice(0, 10),
      attempts: 1,
    })),
  });
});

router.get("/monitoring", async (_req, res) => {
  const [live, recentViolations, allExams, candidates] = await Promise.all([
    prisma.examAttempt.findMany({
      where: { result: "IN_PROGRESS" },
      include: { user: true, exam: true, violations: true },
    }),
    prisma.proctoringViolation.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: true, attempt: { include: { exam: true } } },
    }),
    prisma.exam.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.user.findMany({
      where: { role: "CANDIDATE" },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);
  res.json({
    filterOptions: {
      exams: allExams.map((e) => ({ id: e.id, title: e.title })),
      students: candidates.map((u) => ({ id: u.id, name: u.fullName })),
    },
    sessions: live.map((s) => ({
      id: s.id,
      userId: s.userId,
      examId: s.examId,
      candidate: s.user.fullName,
      exam: s.exam.title,
      started: s.startedAt.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
      warnings: s.warnings,
      status: s.warnings >= 3 ? "Flagged" : "In Progress",
      violations: s.violations.map((v) => ({
        type: v.type,
        time: v.createdAt.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
      })),
    })),
    activityLog: recentViolations.map((v) => ({
      time: v.createdAt.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
      userId: v.userId,
      candidate: v.user.fullName,
      exam: v.attempt.exam.title,
      examId: v.attempt.examId,
      event: v.type,
      severity:
        v.type.includes("Multi") || v.type.toLowerCase().includes("phone")
          ? "Critical"
          : "Warning",
    })),
  });
});

router.get("/certificates", async (_req, res) => {
  const certs = await prisma.certificate.findMany({
    include: { user: true, exam: true },
    orderBy: { issuedOn: "desc" },
  });
  res.json({
    certificates: certs.map((c) => ({
      id: c.id,
      userId: c.userId,
      examId: c.examId,
      candidate: c.user.fullName,
      exam: c.exam.title,
      credentialId: c.credentialId,
      issuedOn: c.issuedOn.toISOString().slice(0, 10),
      score: c.score,
    })),
  });
});

router.post("/certificates/:id/regenerate", async (req, res) => {
  const cert = await prisma.certificate.findUnique({ where: { id: String(req.params.id) } });
  if (!cert) return res.status(404).json({ error: "Not found" });
  const credentialId = `NX-REGEN-${Date.now().toString(36).toUpperCase()}`;
  const updated = await prisma.certificate.update({
    where: { id: cert.id },
    data: { credentialId, issuedOn: new Date() },
  });
  res.json({ credentialId: updated.credentialId });
});

// ——— Reports CSV ———
router.get("/reports/:type", async (req, res) => {
  const type = String(req.params.type);
  let csv = "";
  if (type === "revenue") {
    const rows = await prisma.payment.findMany({
      where: { status: "PAID" },
      include: { user: true, exam: true },
    });
    csv = "Date,User,Exam,Amount,Invoice\n" + rows.map((r) =>
      `${r.createdAt.toISOString().slice(0, 10)},${r.user.fullName},${r.exam.title},${r.amount},${r.invoiceId}`,
    ).join("\n");
  } else if (type === "users") {
    const rows = await prisma.user.findMany({ where: { role: "CANDIDATE" } });
    csv = "Name,Email,Phone,Status,Joined\n" + rows.map((u) =>
      `${u.fullName},${u.email},${u.phone ?? ""},${u.status},${u.createdAt.toISOString().slice(0, 10)}`,
    ).join("\n");
  } else if (type === "results") {
    const rows = await prisma.examAttempt.findMany({
      where: { result: { not: "IN_PROGRESS" } },
      include: { user: true, exam: true },
    });
    csv = "Candidate,Exam,Score,Result,Date\n" + rows.map((r) =>
      `${r.user.fullName},${r.exam.title},${r.score ?? 0},${r.result},${r.startedAt.toISOString().slice(0, 10)}`,
    ).join("\n");
  } else if (type === "violations") {
    const rows = await prisma.proctoringViolation.findMany({ include: { user: true } });
    csv = "Date,User,Type,Detail\n" + rows.map((r) =>
      `${r.createdAt.toISOString()},${r.user.fullName},${r.type},${r.detail ?? ""}`,
    ).join("\n");
  } else {
    return res.status(400).json({ error: "Unknown report type" });
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${type}-report.csv"`);
  res.send(csv);
});

export default router;
