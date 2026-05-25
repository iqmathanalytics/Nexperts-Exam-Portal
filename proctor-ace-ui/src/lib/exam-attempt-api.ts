import { apiAuth } from "@/lib/api-auth";

export async function cancelExamAttempt(attemptId: string) {
  try {
    await apiAuth(`/api/attempts/${attemptId}/cancel`, { method: "DELETE" });
  } catch {
    /* ignore */
  }
  sessionStorage.removeItem(`exam-${attemptId}`);
}

export async function abandonExamAttempt(attemptId: string) {
  try {
    await apiAuth(`/api/attempts/${attemptId}/abandon`, { method: "POST", body: JSON.stringify({}) });
  } catch {
    /* ignore */
  }
  sessionStorage.removeItem(`exam-${attemptId}`);
}
