// src/lib/time-format.ts — display formatting helpers for the employee app.
// Pure functions; safe to import from client components.
import { format } from "date-fns";
import { parseTime12h } from "@/lib/time";

/** "2026-07-07" → "Tue Jul 7" */
export function formatDayFull(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return format(new Date(y, m - 1, day), "EEE MMM d");
}

/** "Today · Tue Jul 7" when d === todayISO, otherwise "Tue Jul 7". */
export function dayLabelWithToday(d: string, todayISO: string): string {
  const label = formatDayFull(d);
  return d === todayISO ? `Today · ${label}` : label;
}

/** "2026-07-06" → "Week of Jul 6" */
export function formatWeekOf(weekStart: string): string {
  const [y, m, day] = weekStart.split("-").map(Number);
  return `Week of ${format(new Date(y, m - 1, day), "MMM d")}`;
}

/** "09:00" → "9:00 AM"; "13:30" → "1:30 PM". Input is the 24-hour storage format. */
export function hhmmTo12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** "9:00 AM" → "09:00"; null when the input isn't a valid 12-hour time. */
export function parse12hToHhmm(input: string): string | null {
  const t = parseTime12h(input);
  if (!t) return null;
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

/** Relative timestamps for the notifications feed. */
export function timeAgo(date: Date, now: Date = new Date()): string {
  const mins = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return format(date, "MMM d");
}

/** The wall-clock date (ISODate) right now in the given IANA timezone. */
export function todayISOIn(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
