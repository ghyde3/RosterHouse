import { describe, expect, it } from "vitest";
import { buildCalendar, escapeText, foldLine, formatUtcInstant, type IcalShift } from "./ical";

const shift = (over: Partial<IcalShift> = {}): IcalShift => ({
  id: "shift-1",
  startsAt: new Date("2026-07-06T11:00:00.000Z"),
  endsAt: new Date("2026-07-06T19:00:00.000Z"),
  positionName: "Line cook",
  locationName: "Test location",
  notes: null,
  ...over,
});

const NOW = new Date("2026-07-01T12:34:56.000Z");

describe("formatUtcInstant", () => {
  it("formats a UTC instant as YYYYMMDDTHHMMSSZ", () => {
    expect(formatUtcInstant(new Date("2026-07-06T11:00:00.000Z"))).toBe("20260706T110000Z");
    expect(formatUtcInstant(new Date("2026-12-31T23:59:59.000Z"))).toBe("20261231T235959Z");
  });
});

describe("escapeText", () => {
  it("escapes commas, semicolons, backslashes, and newlines", () => {
    expect(escapeText("a,b")).toBe("a\\,b");
    expect(escapeText("a;b")).toBe("a\\;b");
    expect(escapeText("a\\b")).toBe("a\\\\b");
    expect(escapeText("a\nb")).toBe("a\\nb");
    expect(escapeText("a\r\nb")).toBe("a\\nb");
  });

  it("escapes backslashes before adding escape backslashes", () => {
    expect(escapeText("\\;")).toBe("\\\\\\;");
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:Line cook shift")).toBe("SUMMARY:Line cook shift");
  });

  it("folds long lines into chunks of at most 75 octets", () => {
    const line = "DESCRIPTION:" + "x".repeat(200);
    const folded = foldLine(line);
    const physical = folded.split("\r\n");
    expect(physical.length).toBeGreaterThan(1);
    for (const p of physical) {
      expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    }
    physical.slice(1).forEach((p) => expect(p.startsWith(" ")).toBe(true));
    // Unfolding (strip CRLF + one space) restores the original line.
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("counts octets, not characters, and never splits a multi-byte character", () => {
    const line = "DESCRIPTION:" + "é".repeat(100); // é = 2 octets in UTF-8
    const folded = foldLine(line);
    for (const p of folded.split("\r\n")) {
      expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});

describe("buildCalendar", () => {
  it("produces an empty calendar with header, no VEVENTs, and CRLF endings", () => {
    const ics = buildCalendar([], NOW);
    expect(ics).toBe(
      "BEGIN:VCALENDAR\r\n" +
        "VERSION:2.0\r\n" +
        "PRODID:-//RosterHouse//EN\r\n" +
        "CALSCALE:GREGORIAN\r\n" +
        "END:VCALENDAR\r\n",
    );
  });

  it("renders one VEVENT per shift with UID, UTC times, summary, and location", () => {
    const ics = buildCalendar([shift()], NOW);
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain("UID:shift-1@rosterhouse\r\n");
    expect(ics).toContain("DTSTAMP:20260701T123456Z\r\n");
    expect(ics).toContain("DTSTART:20260706T110000Z\r\n");
    expect(ics).toContain("DTEND:20260706T190000Z\r\n");
    expect(ics).toContain("SUMMARY:Line cook shift\r\n");
    expect(ics).toContain("LOCATION:Test location\r\n");
    expect(ics).toContain("END:VEVENT\r\n");
    expect(ics).not.toContain("DESCRIPTION");
    // No bare LF anywhere.
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("includes an escaped DESCRIPTION when the shift has notes", () => {
    const ics = buildCalendar([shift({ notes: "Prep list:\nonions, carrots; more" })], NOW);
    expect(ics).toContain("DESCRIPTION:Prep list:\\nonions\\, carrots\\; more\r\n");
  });

  it("escapes commas in summary and location", () => {
    const ics = buildCalendar(
      [shift({ positionName: "Cook, night", locationName: "Cafe; Main St, Springfield" })],
      NOW,
    );
    expect(ics).toContain("SUMMARY:Cook\\, night shift\r\n");
    expect(ics).toContain("LOCATION:Cafe\\; Main St\\, Springfield\r\n");
  });

  it("folds long property lines so every physical line fits in 75 octets", () => {
    const ics = buildCalendar([shift({ notes: "long note ".repeat(30) })], NOW);
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});
