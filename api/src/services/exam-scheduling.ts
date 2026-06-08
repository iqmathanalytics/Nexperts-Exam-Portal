const TZ = "Asia/Kuala_Lumpur";
const WINDOW_START_MINUTES = 10 * 60; // 10:00
const WINDOW_END_MINUTES = 18 * 60; // 18:00 — last bookable start time
const SLOT_STEP_MINUTES = 30;
const EARLY_JOIN_MS = 10 * 60 * 1000;
const BOOKING_HORIZON_DAYS = 365;

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
  | "booking_expired"
  | "completed";

function klParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute: Number(get("minute")),
  };
}

function klDateStringFromParts(p: { year: number; month: number; day: number }): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function todayDateString(): string {
  return klDateStringFromParts(klParts());
}

export function minBookableDateString(): string {
  return todayDateString();
}

export function maxBookableDateString(): string {
  const p = klParts();
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + BOOKING_HORIZON_DAYS));
  return d.toISOString().slice(0, 10);
}

export function attendByFromPurchase(purchasedAt: Date): Date {
  return new Date(purchasedAt.getTime() + BOOKING_HORIZON_DAYS * 24 * 60 * 60 * 1000);
}

export function isBookableDate(dateStr: string): boolean {
  return dateStr >= minBookableDateString() && dateStr <= maxBookableDateString();
}

/** Next 30-min slot boundary at or after now in MYT (for same-day booking). */
function earliestBookableMinutes(now: Date): number {
  const p = klParts(now);
  const current = p.hour * 60 + p.minute;
  const next = Math.ceil(current / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
  return Math.max(WINDOW_START_MINUTES, next);
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

export function generateSlotsForDate(
  dateStr: string,
  durationMinutes: number,
  now = new Date(),
): ScheduleSlot[] {
  const isToday = dateStr === klDateStringFromParts(klParts(now));
  const minStart = isToday ? earliestBookableMinutes(now) : WINDOW_START_MINUTES;
  if (minStart > WINDOW_END_MINUTES) return [];

  const slots: ScheduleSlot[] = [];
  for (let m = minStart; m <= WINDOW_END_MINUTES; m += SLOT_STEP_MINUTES) {
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

export function addKlDays(dateStr: string, days: number): string {
  const noon = parseScheduledStart(dateStr, "12:00");
  const shifted = new Date(noon.getTime() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(shifted);
}

/** First calendar date (from `fromDate`) that still has at least one bookable slot. */
export function firstDateWithSlots(
  durationMinutes: number,
  fromDate = minBookableDateString(),
  now = new Date(),
): { date: string; slots: ScheduleSlot[] } {
  let date = fromDate;
  const max = maxBookableDateString();
  for (let guard = 0; guard < 400 && date <= max; guard++) {
    const slots = generateSlotsForDate(date, durationMinutes, now);
    if (slots.length > 0) return { date, slots };
    date = addKlDays(date, 1);
  }
  return { date: fromDate, slots: [] };
}

export function validateScheduledSlot(
  dateStr: string,
  timeStr: string,
  durationMinutes: number,
  now = new Date(),
): { startAt: Date; endAt: Date } {
  if (!isBookableDate(dateStr)) {
    throw new Error("Date must be between today and one year from now");
  }
  const slots = generateSlotsForDate(dateStr, durationMinutes, now);
  const match = slots.find((s) => s.startTime === timeStr);
  if (!match) throw new Error("Invalid or unavailable time slot");
  return { startAt: new Date(match.startAt), endAt: new Date(match.endAt) };
}

export function getSchedulePhase(
  scheduledStartAt: Date | null | undefined,
  scheduledEndAt: Date | null | undefined,
  opts: {
    hasInProgress: boolean;
    attemptsExhausted: boolean;
    attendByAt?: Date | null;
  },
  now = new Date(),
): SchedulePhase {
  if (!scheduledStartAt || !scheduledEndAt) return "not_scheduled";
  if (opts.attendByAt && now > opts.attendByAt) return "booking_expired";
  if (opts.hasInProgress) return "in_progress";
  if (opts.attemptsExhausted && now > scheduledEndAt) return "completed";
  const joinFrom = new Date(scheduledStartAt.getTime() - EARLY_JOIN_MS);
  if (now < joinFrom) return "too_early";
  if (now >= joinFrom && now < scheduledStartAt) return "waiting";
  if (now >= scheduledStartAt && now <= scheduledEndAt) return "ready";
  if (now > scheduledEndAt && opts.attendByAt && now <= opts.attendByAt) return "expired";
  if (now > scheduledEndAt) return "expired";
  return "expired";
}

export function isSlotAlignedStart(startAt: Date): boolean {
  const p = klParts(startAt);
  return p.minute % SLOT_STEP_MINUTES === 0;
}

function slotTimeString(startAt: Date): string {
  const p = klParts(startAt);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

function snapToDisplaySlot(at: Date): Date {
  const p = klParts(at);
  let hour = p.hour;
  let minute = Math.round(p.minute / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
  if (minute >= 60) {
    hour += 1;
    minute = 0;
  }
  const dateStr = klDateStringFromParts(p);
  return parseScheduledStart(dateStr, `${hour}:${minute}`);
}

function formatKlTime(at: Date): string {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(at)
    .replace(/\s/g, " ")
    .toLowerCase();
}

function formatKlDateShort(at: Date): string {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(at);
}

/** Attempt timer ends at startedAt + duration, capped by a booked slot window when applicable. */
export function computeAttemptEndsAt(
  attemptStartedAt: Date,
  durationMinutes: number,
  scheduledStartAt?: Date | null,
  scheduledEndAt?: Date | null,
): Date {
  const attemptEnd = new Date(attemptStartedAt.getTime() + durationMinutes * 60 * 1000);
  if (!scheduledStartAt || !scheduledEndAt) return attemptEnd;
  if (!isSlotAlignedStart(scheduledStartAt)) return attemptEnd;
  return new Date(Math.min(attemptEnd.getTime(), scheduledEndAt.getTime()));
}

export function formatScheduleForApi(startAt: Date, endAt: Date) {
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(startAt);
  const aligned = isSlotAlignedStart(startAt);
  const displayStart = aligned ? startAt : snapToDisplaySlot(startAt);
  const durationMs = endAt.getTime() - startAt.getTime();
  const displayEnd = aligned ? endAt : new Date(displayStart.getTime() + durationMs);

  let scheduledLabel: string;
  if (aligned) {
    const startTime = slotTimeString(startAt);
    const durationMin = Math.round(durationMs / 60_000);
    const slots = generateSlotsForDate(dateStr, durationMin, new Date(0));
    const match = slots.find((s) => s.startTime === startTime);
    scheduledLabel = match
      ? `${formatKlDateShort(startAt)} · ${match.label}`
      : `${formatKlDateShort(startAt)} · ${formatKlTime(displayStart)} – ${formatKlTime(displayEnd)}`;
  } else {
    scheduledLabel = `${formatKlDateShort(displayStart)} · ${formatKlTime(displayStart)} – ${formatKlTime(displayEnd)}`;
  }

  return {
    scheduledStartAt: startAt.toISOString(),
    scheduledEndAt: endAt.toISOString(),
    scheduledDate: dateStr,
    scheduledStartTime: slotTimeString(aligned ? startAt : displayStart),
    scheduledLabel,
  };
}
