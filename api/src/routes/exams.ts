import { Router } from "express";
import { ExamStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { formatExam } from "../lib/formatters.js";

const router = Router();

router.get("/", async (_req, res) => {
  const exams = await prisma.exam.findMany({
    where: { status: ExamStatus.PUBLISHED },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    exams: exams.map((e) => ({
      ...formatExam(e),
      difficulty: "Intermediate",
      attempts: e.maxAttempts,
    })),
  });
});

router.get("/:id", async (req, res) => {
  const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
  if (!exam) return res.status(404).json({ error: "Exam not found" });
  res.json({ exam });
});

export default router;
