import { TZDate } from "@date-fns/tz";
import { format, parseISO } from "date-fns";

export type ISODate = string; // "2026-07-06" (calendar date, no timezone)
export type TimeOfDay = { hour: number; minute: number }; // 24-hour clock
/** Alias kept so Phase 1's @/components/ui/time-field-parse re-export type-checks. */
export type ParsedTime = TimeOfDay;

export const DAY_NAMES_MON0 = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

function partsOf(d: ISODate): [number, number, number] {
  const [y, m, day] = d.split("-").map(Number);
  return [y, m, day];
}

/** Monday of the week containing instant `d`, evaluated in `timezone`. */
export function weekStartOf(d: Date, timezone: string): ISODate {
  const local = new TZDate(d.getTime(), timezone);
  const mondayOffset = (local.getDay() + 6) % 7; // Date#getDay: 0=Sun..6=Sat
  const monday = new TZDate(
    local.getFullYear(), local.getMonth(), local.getDate() - mondayOffset, timezone,
  );
  return format(monday, "yyyy-MM-dd");
}

export function addDaysISO(d: ISODate, n: number): ISODate {
  const [y, m, day] = partsOf(d);
  return new Date(Date.UTC(y, m - 1, day + n)).toISOString().slice(0, 10);
}

export function weekDatesOf(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
}

/** 0=Monday .. 6=Sunday — matches AvailabilityRule.dayOfWeek. */
export function dayOfWeekMon0(d: ISODate): number {
  const [y, m, day] = partsOf(d);
  return (new Date(Date.UTC(y, m - 1, day)).getUTCDay() + 6) % 7;
}

export function weekStartOfISO(d: ISODate): ISODate {
  return addDaysISO(d, -dayOfWeekMon0(d));
}

/**
 * Parse a 12-hour time string ("7:00 AM", "7 AM", "7:30 pm", "9:00 a.m.").
 * Returns 24-hour values ({ hour: 0-23 }) or null for anything invalid
 * ("13:00 PM", "7:60 AM", missing AM/PM, empty).
 *
 * This is Phase 1's implementation from src/components/ui/time-field-parse.ts,
 * moved here verbatim per the pinned handoff (dotted a.m./p.m. accepted);
 * that file now re-exports from this module (Step 6).
 */
export function parseTime12h(input: string): TimeOfDay | null {
  const match = /^\s*(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\s*$/i.exec(input);
  if (!match) return null;
  const rawHour = Number(match[1]);
  if (rawHour < 1 || rawHour > 12) return null;
  const minute = match[2] === undefined ? 0 : Number(match[2]);
  const isPm = match[3].toLowerCase().startsWith("p");
  let hour = rawHour % 12; // 12 AM → 0; 12 PM → 0 then +12 below
  if (isPm) hour += 12;
  return { hour, minute };
}

export function localToUtc(date: ISODate, time: TimeOfDay, timezone: string): Date {
  const [y, m, day] = partsOf(date);
  const local = new TZDate(y, m - 1, day, time.hour, time.minute, 0, 0, timezone);
  return new Date(local.getTime());
}

/**
 * UTC instants for a shift on service date `date`.
 * End at-or-before start means the shift crosses midnight and ends the next day.
 */
export function shiftInstants(
  date: ISODate, start: TimeOfDay, end: TimeOfDay, timezone: string,
): { startsAt: Date; endsAt: Date } {
  const startsAt = localToUtc(date, start, timezone);
  const crossesMidnight =
    end.hour < start.hour || (end.hour === start.hour && end.minute <= start.minute);
  const endsAt = localToUtc(crossesMidnight ? addDaysISO(date, 1) : date, end, timezone);
  return { startsAt, endsAt };
}

export function localTimeOfDay(instant: Date, timezone: string): TimeOfDay {
  const local = new TZDate(instant.getTime(), timezone);
  return { hour: local.getHours(), minute: local.getMinutes() };
}

export function localISODate(instant: Date, timezone: string): ISODate {
  return format(new TZDate(instant.getTime(), timezone), "yyyy-MM-dd");
}

/** Prisma returns @db.Date columns as UTC-midnight Date objects. */
export function toISODate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function formatTime(instant: Date, timezone: string): string {
  return format(new TZDate(instant.getTime(), timezone), "h:mm a");
}

/** "09:00" (AvailabilityRule window string) → "9:00 AM". */
export function formatTimeHM(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatShiftRange(startsAt: Date, endsAt: Date, timezone: string): string {
  return `${formatTime(startsAt, timezone)} – ${formatTime(endsAt, timezone)}`;
}

export function shiftDurationHours(startsAt: Date, endsAt: Date): number {
  return Math.round(((endsAt.getTime() - startsAt.getTime()) / 3_600_000) * 100) / 100;
}

export function formatDurationHrs(hours: number): string {
  return `${hours} hrs`;
}

export function formatDayLabel(d: ISODate): string {
  const [y, m, day] = partsOf(d);
  return format(new Date(y, m - 1, day), "EEE d");
}

export function formatDateShort(d: ISODate): string {
  const [y, m, day] = partsOf(d);
  return format(new Date(y, m - 1, day), "MMM d");
}

export function formatFullDate(d: ISODate): string {
  const [y, m, day] = partsOf(d);
  return format(new Date(y, m - 1, day), "EEEE, MMMM d");
}

// --- Calendar-date labels (Phase 5) ------------------------------------
// These format pure calendar dates (ISODate strings), so no timezone is
// involved — parseISO gives local midnight and format reads it back out.

export function formatMediumDate(d: ISODate): string {
  return format(parseISO(d), "EEE MMM d"); // "Sat Jul 12"
}

export function formatDateRange(start: ISODate, end: ISODate): string {
  const label = (x: ISODate) => format(parseISO(x), "MMM d");
  return start === end ? label(start) : `${label(start)} – ${label(end)}`;
}
