import { apiAuth } from "@/lib/api-auth";
import { apiBase } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

export type ExamSubmitResult = {
  score: number;
  result: string;
  passed: boolean;
  examTitle: string;
  passScore: number;
  credentialId: string | null;
};

function clearStoredSession(attemptId: string) {
  sessionStorage.removeItem(`exam-${attemptId}`);
}

export async function cancelExamAttempt(attemptId: string) {
  try {
    await apiAuth(`/api/attempts/${attemptId}/cancel`, { method: "DELETE" });
  } catch {
    /* ignore — only for pre-start cleanup */
  }
  clearStoredSession(attemptId);
}

export async function abandonExamAttempt(attemptId: string) {
  try {
    await apiAuth(`/api/attempts/${attemptId}/abandon`, { method: "POST", body: JSON.stringify({}) });
  } catch {
    /* ignore */
  }
  clearStoredSession(attemptId);
}

/** Best-effort abandon when the tab is closing (keepalive so the request may still complete). */
export function abandonExamAttemptKeepalive(attemptId: string) {
  const token = getToken();
  if (!token) return;
  try {
    void fetch(`${apiBase}/api/attempts/${attemptId}/abandon`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      keepalive: true,
      cache: "no-store",
    });
  } catch {
    /* ignore */
  }
  clearStoredSession(attemptId);
}

export async function submitExamAttempt(
  attemptId: string,
  answers: Record<string, string>,
): Promise<ExamSubmitResult> {
  const res = await apiAuth<ExamSubmitResult>(`/api/attempts/${attemptId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
  clearStoredSession(attemptId);
  return res;
}

/** Submit answers; if that fails, mark the attempt as failed so it still counts. */
export async function finalizeExamAttempt(
  attemptId: string,
  answers: Record<string, string>,
): Promise<ExamSubmitResult | null> {
  try {
    return await submitExamAttempt(attemptId, answers);
  } catch {
    try {
      await abandonExamAttempt(attemptId);
    } catch {
      /* ignore */
    }
    return null;
  }
}
