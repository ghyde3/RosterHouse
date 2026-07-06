import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  DAY_NAMES_MON0,
  dayOfWeekMon0,
  formatDateShort,
  formatDayLabel,
  formatDurationHrs,
  formatFullDate,
  formatShiftRange,
  formatTime,
  formatTimeHM,
  localISODate,
  localTimeOfDay,
  localToUtc,
  parseTime12h,
  shiftDurationHours,
  shiftInstants,
  toISODate,
  weekDatesOf,
  weekStartOf,
  weekStartOfISO,
} from "@/lib/time";

const NY = "America/New_York";
const TOKYO = "Asia/Tokyo";

describe("weekStartOf", () => {
  it("returns the same day for a Monday instant in the location timezone", () => {
    // 2026-07-06T16:00:00Z = Monday July 6, 12:00 PM in New York
    expect(weekStartOf(new Date("2026-07-06T16:00:00Z"), NY)).toBe("2026-07-06");
  });

  it("depends on timezone: one instant, two different weeks", () => {
    // 2026-07-06T02:00:00Z = Sunday July 5, 10:00 PM in New York
    //                      = Monday July 6, 11:00 AM in Tokyo
    const instant = new Date("2026-07-06T02:00:00Z");
    expect(weekStartOf(instant, NY)).toBe("2026-06-29");
    expect(weekStartOf(instant, TOKYO)).toBe("2026-07-06");
  });

  it("maps a Sunday back to the previous Monday (weeks start Monday)", () => {
    // 2026-07-12T16:00:00Z = Sunday July 12 in New York
    expect(weekStartOf(new Date("2026-07-12T16:00:00Z"), NY)).toBe("2026-07-06");
  });
});

describe("ISO date helpers", () => {
  it("addDaysISO crosses month and year boundaries", () => {
    expect(addDaysISO("2026-06-29", 7)).toBe("2026-07-06");
    expect(addDaysISO("2026-07-06", -7)).toBe("2026-06-29");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("weekDatesOf returns 7 consecutive dates starting at the given Monday", () => {
    expect(weekDatesOf("2026-07-06")).toEqual([
      "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09",
      "2026-07-10", "2026-07-11", "2026-07-12",
    ]);
  });

  it("dayOfWeekMon0 maps Monday to 0 and Sunday to 6", () => {
    expect(dayOfWeekMon0("2026-07-06")).toBe(0); // Monday
    expect(dayOfWeekMon0("2026-07-12")).toBe(6); // Sunday
    expect(DAY_NAMES_MON0[dayOfWeekMon0("2026-07-08")]).toBe("Wednesday");
  });

  it("weekStartOfISO finds the Monday of any date", () => {
    expect(weekStartOfISO("2026-07-09")).toBe("2026-07-06");
    expect(weekStartOfISO("2026-07-06")).toBe("2026-07-06");
    expect(weekStartOfISO("2026-07-12")).toBe("2026-07-06");
  });

  it("toISODate formats a UTC-midnight Date (Prisma @db.Date)", () => {
    expect(toISODate(new Date("2026-07-06T00:00:00.000Z"))).toBe("2026-07-06");
  });
});

describe("parseTime12h", () => {
  it("parses standard and shorthand inputs (24-hour output)", () => {
    expect(parseTime12h("7:00 AM")).toEqual({ hour: 7, minute: 0 });
    expect(parseTime12h("7 AM")).toEqual({ hour: 7, minute: 0 });
    expect(parseTime12h("7am")).toEqual({ hour: 7, minute: 0 });          // no space (Phase 1 contract)
    expect(parseTime12h("9:00 a.m.")).toEqual({ hour: 9, minute: 0 });    // dotted meridiem (Phase 1 contract)
    expect(parseTime12h("7:30 pm")).toEqual({ hour: 19, minute: 30 });
    expect(parseTime12h(" 11:15 pm ")).toEqual({ hour: 23, minute: 15 });
  });

  it("handles the 12 o'clock edge cases", () => {
    expect(parseTime12h("12:00 PM")).toEqual({ hour: 12, minute: 0 }); // noon
    expect(parseTime12h("12:00 AM")).toEqual({ hour: 0, minute: 0 });  // midnight
  });

  it("rejects invalid input", () => {
    expect(parseTime12h("13:00 PM")).toBeNull();
    expect(parseTime12h("0:30 AM")).toBeNull();
    expect(parseTime12h("7:60 AM")).toBeNull();
    expect(parseTime12h("700")).toBeNull();
    expect(parseTime12h("7:00")).toBeNull();
    expect(parseTime12h("")).toBeNull();
  });
});

describe("localToUtc / shiftInstants", () => {
  it("converts local wall time to a UTC instant (EDT is UTC-4)", () => {
    expect(localToUtc("2026-07-06", { hour: 7, minute: 0 }, NY).toISOString())
      .toBe("2026-07-06T11:00:00.000Z");
  });

  it("respects winter offsets (EST is UTC-5)", () => {
    expect(localToUtc("2026-01-05", { hour: 7, minute: 0 }, NY).toISOString())
      .toBe("2026-01-05T12:00:00.000Z");
  });

  it("a 5:00 PM – 12:00 AM shift ends the next day", () => {
    const { startsAt, endsAt } = shiftInstants(
      "2026-07-10", { hour: 17, minute: 0 }, { hour: 0, minute: 0 }, NY,
    );
    expect(startsAt.toISOString()).toBe("2026-07-10T21:00:00.000Z");
    expect(endsAt.toISOString()).toBe("2026-07-11T04:00:00.000Z");
    expect(shiftDurationHours(startsAt, endsAt)).toBe(7);
    expect(formatShiftRange(startsAt, endsAt, NY)).toBe("5:00 PM – 12:00 AM");
  });

  it("spring-forward night: 11:00 PM – 7:00 AM is only 7 real hours", () => {
    // DST starts 2026-03-08 in America/New_York (2:00 AM is skipped)
    const { startsAt, endsAt } = shiftInstants(
      "2026-03-07", { hour: 23, minute: 0 }, { hour: 7, minute: 0 }, NY,
    );
    expect(shiftDurationHours(startsAt, endsAt)).toBe(7);
  });

  it("fall-back night: 11:00 PM – 7:00 AM is 9 real hours", () => {
    // DST ends 2026-11-01 in America/New_York (1:00 AM repeats)
    const { startsAt, endsAt } = shiftInstants(
      "2026-10-31", { hour: 23, minute: 0 }, { hour: 7, minute: 0 }, NY,
    );
    expect(shiftDurationHours(startsAt, endsAt)).toBe(9);
  });
});

describe("formatting", () => {
  it("formatTime renders 12-hour wall clock in the location timezone", () => {
    expect(formatTime(new Date("2026-07-06T11:00:00Z"), NY)).toBe("7:00 AM");
    expect(formatTime(new Date("2026-03-08T12:00:00Z"), NY)).toBe("8:00 AM"); // EDT after spring-forward
  });

  it("formatShiftRange uses an en dash with spaces", () => {
    expect(formatShiftRange(
      new Date("2026-07-06T11:00:00Z"), new Date("2026-07-06T19:00:00Z"), NY,
    )).toBe("7:00 AM – 3:00 PM");
  });

  it("shiftDurationHours handles fractional hours", () => {
    expect(shiftDurationHours(new Date("2026-07-06T11:00:00Z"), new Date("2026-07-06T19:00:00Z"))).toBe(8);
    expect(shiftDurationHours(new Date("2026-07-06T11:00:00Z"), new Date("2026-07-06T18:30:00Z"))).toBe(7.5);
  });

  it("formatDurationHrs", () => {
    expect(formatDurationHrs(8)).toBe("8 hrs");
    expect(formatDurationHrs(7.5)).toBe("7.5 hrs");
  });

  it("formatTimeHM converts availability window strings", () => {
    expect(formatTimeHM("09:00")).toBe("9:00 AM");
    expect(formatTimeHM("15:00")).toBe("3:00 PM");
    expect(formatTimeHM("00:30")).toBe("12:30 AM");
    expect(formatTimeHM("12:00")).toBe("12:00 PM");
  });

  it("date labels", () => {
    expect(formatDayLabel("2026-07-06")).toBe("Mon 6");
    expect(formatDateShort("2026-07-06")).toBe("Jul 6");
    expect(formatFullDate("2026-07-06")).toBe("Monday, July 6");
  });

  it("localTimeOfDay and localISODate read wall-clock values in a timezone", () => {
    const instant = new Date("2026-07-11T02:30:00Z"); // Jul 10, 10:30 PM in New York
    expect(localTimeOfDay(instant, NY)).toEqual({ hour: 22, minute: 30 });
    expect(localISODate(instant, NY)).toBe("2026-07-10");
    expect(localISODate(instant, TOKYO)).toBe("2026-07-11");
  });
});
