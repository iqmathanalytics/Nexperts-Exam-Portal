export type ExamStartPayload = {
  attemptId: string;
  exam: {
    id?: string;
    title: string;
    duration?: number;
    passScore?: number;
    proctoring: boolean;
    fullscreen: boolean;
    tabDetection: boolean;
    webcam: boolean;
  };
  questions: { id: string; title: string; type: string; options: string[] }[];
  endsAt: string;
};

export function parseStoredExamSession(attemptId: string): ExamStartPayload | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(`exam-${attemptId}`);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<ExamStartPayload>;
    if (!data.exam?.title || !Array.isArray(data.questions) || !data.endsAt) return null;
    return data as ExamStartPayload;
  } catch {
    return null;
  }
}

export function storeExamSession(attemptId: string, payload: ExamStartPayload) {
  sessionStorage.setItem(`exam-${attemptId}`, JSON.stringify(payload));
}
