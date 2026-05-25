export type ScheduleSlot = {
  startTime: string;
  endTime: string;
  startAt: string;
  endAt: string;
  label: string;
};

export type SchedulePhase =
  | "not_scheduled"
  | "too_early"
  | "waiting"
  | "ready"
  | "in_progress"
  | "expired"
  | "completed";

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
