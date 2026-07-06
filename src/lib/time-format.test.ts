import { describe, expect, it } from "vitest";
import {
  dayLabelWithToday,
  formatDayFull,
  formatWeekOf,
  hhmmTo12h,
  parse12hToHhmm,
  timeAgo,
  todayISOIn,
} from "@/lib/time-format";

describe("formatDayFull", () => {
  it("formats an ISO date as 'EEE MMM d'", () => {
    expect(formatDayFull("2026-07-07")).toBe("Tue Jul 7");
    expect(formatDayFull("2026-07-06")).toBe("Mon Jul 6");
  });
});

describe("dayLabelWithToday", () => {
  it("prefixes Today when the date is today", () => {
    expect(dayLabelWithToday("2026-07-07", "2026-07-07")).toBe("Today · Tue Jul 7");
  });
  it("returns the plain label otherwise", () => {
    expect(dayLabelWithToday("2026-07-08", "2026-07-07")).toBe("Wed Jul 8");
  });
});

describe("formatWeekOf", () => {
  it("formats the Monday of the week", () => {
    expect(formatWeekOf("2026-07-06")).toBe("Week of Jul 6");
  });
});

describe("hhmmTo12h", () => {
  it("converts 24-hour storage strings to 12-hour display", () => {
    expect(hhmmTo12h("09:00")).toBe("9:00 AM");
    expect(hhmmTo12h("13:30")).toBe("1:30 PM");
    expect(hhmmTo12h("00:15")).toBe("12:15 AM");
    expect(hhmmTo12h("12:00")).toBe("12:00 PM");
  });
});

describe("parse12hToHhmm", () => {
  it("converts valid 12-hour input to a 24-hour storage string", () => {
    expect(parse12hToHhmm("9:00 AM")).toBe("09:00");
    expect(parse12hToHhmm("1:30 PM")).toBe("13:30");
    expect(parse12hToHhmm("12:15 AM")).toBe("00:15");
  });
  it("returns null for invalid input", () => {
    expect(parse12hToHhmm("25:00")).toBeNull();
    expect(parse12hToHhmm("soon")).toBeNull();
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-07-07T12:00:00.000Z");
  it("handles minutes, hours, days, and older dates", () => {
    expect(timeAgo(new Date("2026-07-07T11:59:40.000Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-07-07T11:55:00.000Z"), now)).toBe("5m ago");
    expect(timeAgo(new Date("2026-07-07T10:00:00.000Z"), now)).toBe("2h ago");
    expect(timeAgo(new Date("2026-07-06T11:00:00.000Z"), now)).toBe("1d ago");
    expect(timeAgo(new Date("2026-06-30T12:00:00.000Z"), now)).toBe("Jun 30");
  });
});

describe("todayISOIn", () => {
  it("returns the wall-clock date in the given timezone", () => {
    // 3:00 AM UTC on Jul 6 is still Jul 5 in New York (UTC-4 in July).
    expect(todayISOIn("America/New_York", new Date("2026-07-06T03:00:00.000Z"))).toBe("2026-07-05");
    expect(todayISOIn("America/New_York", new Date("2026-07-06T12:00:00.000Z"))).toBe("2026-07-06");
  });
});
