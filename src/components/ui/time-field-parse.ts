export type ParsedTime = { hour: number; minute: number };

/**
 * Parse a 12-hour wall-clock string ("7:00 AM", "7 pm", "9:00 a.m.") into
 * a 24-hour { hour, minute }. Returns null for anything invalid — including
 * a missing meridiem, which would be ambiguous.
 *
 * NOTE (Phase 3): this is the roadmap's src/lib/time.ts parseTime12h,
 * shipped locally so Phase 1 stands alone. Phase 3 moves the implementation
 * to src/lib/time.ts and replaces this file's body with:
 *   export { parseTime12h, type ParsedTime } from "@/lib/time";
 */
export function parseTime12h(input: string): ParsedTime | null {
  const match = /^\s*(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\s*$/i.exec(
    input
  );
  if (!match) return null;
  const rawHour = Number(match[1]);
  if (rawHour < 1 || rawHour > 12) return null;
  const minute = match[2] === undefined ? 0 : Number(match[2]);
  const isPm = match[3].toLowerCase().startsWith("p");
  let hour = rawHour % 12; // 12 AM -> 0; 12 PM -> 0, then +12 below
  if (isPm) hour += 12;
  return { hour, minute };
}
