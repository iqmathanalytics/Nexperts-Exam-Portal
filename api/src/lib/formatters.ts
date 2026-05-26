import type { Exam, ExamStatus, Question, QuestionType } from "@prisma/client";

export function examStatusToUi(status: ExamStatus): "Draft" | "Published" | "Archived" {
  if (status === "PUBLISHED") return "Published";
  if (status === "ARCHIVED") return "Archived";
  return "Draft";
}

export function examStatusFromUi(status: string): ExamStatus {
  if (status === "Published") return "PUBLISHED";
  if (status === "Archived") return "ARCHIVED";
  return "DRAFT";
}

export function questionTypeToUi(type: QuestionType): string {
  if (type === "TRUE_FALSE") return "True/False";
  if (type === "SCENARIO") return "Scenario";
  return "Multiple Choice";
}

export function questionTypeFromUi(type: string): QuestionType {
  if (type === "True/False") return "TRUE_FALSE";
  if (type === "Scenario") return "SCENARIO";
  return "MULTIPLE_CHOICE";
}

export function formatExam(e: Exam) {
  return {
    id: e.id,
    title: e.title,
    category: e.category,
    description: e.description,
    duration: e.duration,
    questions: e.questions,
    passScore: e.passScore,
    maxAttempts: e.maxAttempts,
    price: Number(e.price),
    startDate: e.startDate ? e.startDate.toISOString().slice(0, 10) : "",
    status: examStatusToUi(e.status),
    proctoring: e.proctoring,
    fullscreen: e.fullscreen,
    tabDetection: e.tabDetection,
    webcam: e.webcam,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export function formatQuestion(q: Question) {
  return {
    id: q.id,
    examId: q.examId,
    title: q.title,
    type: questionTypeToUi(q.type),
    options: q.options as string[],
    correctAnswer: q.correctAnswer,
    explanation: q.explanation ?? "",
    difficulty: q.difficulty,
    topic: q.topic,
    tags: (q.tags as string[]) ?? [],
    imageUrl: q.imageUrl ?? null,
  };
}
