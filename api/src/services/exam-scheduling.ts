const TZ = "Asia/Kuala_Lumpur";
const WINDOW_START_MINUTES = 10 * 60; // 10:00
const WINDOW_END_MINUTES = 18 * 60; // 18:00 — exam must finish by this time
const SLOT_STEP_MINUTES = 30;
const EARLY_JOIN_MS = 10 * 60 * 1000;

export type ScheduleSlot = {
  startTime: string; // HH:mm
  endTime: string;
  startAt: string; // ISO UTC
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

function klParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

export function minBookableDateString(): string {
  const p = klParts();
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  return d.toISOString().slice(0, 10);
}

export function isBookableDate(dateStr: string): boolean {
  return dateStr >= minBookableDateString();
}

/** Parse YYYY-MM-DD + HH:mm in Malaysia time to UTC Date */
export function parseScheduledStart(dateStr: string, timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) throw new Error("Invalid time");
  return new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+08:00`);
}

export function scheduledEndFromStart(start: Date, durationMinutes: number): Date {
  return new Date(start.getTime() + durationMinutes * 60 * 1000);
}

export function generateSlotsForDate(dateStr: string, durationMinutes: number): ScheduleSlot[] {
  const lastStartMinute = WINDOW_END_MINUTES - durationMinutes;
  if (lastStartMinute < WINDOW_START_MINUTES) return [];

  const slots: ScheduleSlot[] = [];
  for (let m = WINDOW_START_MINUTES; m <= lastStartMinute; m += SLOT_STEP_MINUTES) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const startTime = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    const startAt = parseScheduledStart(dateStr, startTime);
    const endAt = scheduledEndFromStart(startAt, durationMinutes);
    const endKl = new Intl.DateTimeFormat("en-MY", {
      timeZone: TZ,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(endAt);
    const startKl = new Intl.DateTimeFormat("en-MY", {
      timeZone: TZ,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(startAt);
    slots.push({
      startTime,
      endTime: endKl.replace(/\s/g, " ").toLowerCase(),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      label: `${startKl} – ${endKl}`,
    });
  }
  return slots;
}

export function validateScheduledSlot(
  dateStr: string,
  timeStr: string,
  durationMinutes: number,
): { startAt: Date; endAt: Date } {
  if (!isBookableDate(dateStr)) {
    throw new Error("You can only schedule from tomorrow onwards");
  }
  const slots = generateSlotsForDate(dateStr, durationMinutes);
  const match = slots.find((s) => s.startTime === timeStr);
  if (!match) throw new Error("Invalid time slot for this exam duration");
  return { startAt: new Date(match.startAt), endAt: new Date(match.endAt) };
}

export function getSchedulePhase(
  scheduledStartAt: Date | null | undefined,
  scheduledEndAt: Date | null | undefined,
  opts: { hasInProgress: boolean; attemptsExhausted: boolean },
  now = new Date(),
): SchedulePhase {
  if (!scheduledStartAt || !scheduledEndAt) return "not_scheduled";
  if (opts.hasInProgress) return "in_progress";
  if (opts.attemptsExhausted && now > scheduledEndAt) return "completed";
  const joinFrom = new Date(scheduledStartAt.getTime() - EARLY_JOIN_MS);
  if (now < joinFrom) return "too_early";
  if (now >= joinFrom && now < scheduledStartAt) return "waiting";
  if (now >= scheduledStartAt && now <= scheduledEndAt) return "ready";
  return "expired";
}

export function formatScheduleForApi(startAt: Date, endAt: Date) {
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(startAt);
  const startTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(startAt);
  return {
    scheduledStartAt: startAt.toISOString(),
    scheduledEndAt: endAt.toISOString(),
    scheduledDate: dateStr,
    scheduledStartTime: startTime,
    scheduledLabel: new Intl.DateTimeFormat("en-MY", {
      timeZone: TZ,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(startAt),
  };
}
