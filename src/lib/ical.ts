// src/lib/ical.ts — pure RFC 5545 VCALENDAR building for the calendar feed.
// No timezone math: DTSTART/DTEND are the stored UTC instants formatted as
// YYYYMMDDTHHMMSSZ, which calendar apps localize themselves.

export type IcalShift = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  positionName: string;
  locationName: string;
  notes?: string | null;
};

const CRLF = "\r\n";

/** Escape TEXT property values per RFC 5545 §3.3.11 (backslash first). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** UTC instant → "YYYYMMDDTHHMMSSZ". */
export function formatUtcInstant(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
}

/**
 * Fold a content line to lines of at most 75 octets per RFC 5545 §3.1:
 * continuation lines start with CRLF + a single space. Splits on UTF-8
 * octet count without breaking a multi-byte character.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let current = "";
  let currentOctets = 0;
  // Continuation lines carry a leading space that counts toward the 75.
  let limit = 75;
  for (const ch of line) {
    const chOctets = encoder.encode(ch).length;
    if (currentOctets + chOctets > limit) {
      parts.push(current);
      current = ch;
      currentOctets = chOctets;
      limit = 74; // subsequent lines: 1 octet used by the leading space
    } else {
      current += ch;
      currentOctets += chOctets;
    }
  }
  if (current) parts.push(current);
  return parts.join(CRLF + " ");
}

/**
 * Build the full VCALENDAR document for an employee's shifts.
 * `now` feeds DTSTAMP and is injectable for tests.
 */
export function buildCalendar(shifts: IcalShift[], now: Date = new Date()): string {
  const dtstamp = formatUtcInstant(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RosterHouse//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const shift of shifts) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${shift.id}@rosterhouse`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${formatUtcInstant(shift.startsAt)}`,
      `DTEND:${formatUtcInstant(shift.endsAt)}`,
      `SUMMARY:${escapeText(`${shift.positionName} shift`)}`,
      `LOCATION:${escapeText(shift.locationName)}`,
    );
    if (shift.notes) lines.push(`DESCRIPTION:${escapeText(shift.notes)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}
