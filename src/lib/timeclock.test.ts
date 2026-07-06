import { describe, expect, it } from "vitest";
import { pickClockInShift, sumHoursToday } from "@/lib/timeclock";

const T = (iso: string) => new Date(iso);

describe("pickClockInShift", () => {
  const shifts = [
    { id: "a", startsAt: T("2026-07-10T11:00:00Z"), endsAt: T("2026-07-10T19:00:00Z") },
    { id: "b", startsAt: T("2026-07-10T19:00:00Z"), endsAt: T("2026-07-11T01:00:00Z") },
  ];

  it("matches a shift once inside the 30-minute early window", () => {
    expect(pickClockInShift(shifts, T("2026-07-10T10:31:00Z"))?.id).toBe("a");
  });

  it("does not match more than 30 minutes early", () => {
    expect(pickClockInShift(shifts, T("2026-07-10T10:29:00Z"))).toBeNull();
  });

  it("matches until the shift ends", () => {
    expect(pickClockInShift(shifts, T("2026-07-10T18:59:00Z"))?.id).toBe("a");
  });

  it("prefers the earlier shift when windows overlap", () => {
    expect(pickClockInShift(shifts, T("2026-07-10T18:45:00Z"))?.id).toBe("a");
  });

  it("returns null when nothing matches", () => {
    expect(pickClockInShift([], T("2026-07-10T12:00:00Z"))).toBeNull();
  });
});

describe("sumHoursToday", () => {
  it("sums completed entries to one decimal", () => {
    const entries = [
      { clockInAt: T("2026-07-10T11:00:00Z"), clockOutAt: T("2026-07-10T15:30:00Z") }, // 4.5
      { clockInAt: T("2026-07-10T16:00:00Z"), clockOutAt: T("2026-07-10T19:00:00Z") }, // 3
    ];
    expect(sumHoursToday(entries, T("2026-07-10T20:00:00Z"))).toBe(7.5);
  });

  it("counts an open entry up to now", () => {
    const entries = [{ clockInAt: T("2026-07-10T11:00:00Z"), clockOutAt: null }];
    expect(sumHoursToday(entries, T("2026-07-10T13:00:00Z"))).toBe(2);
  });

  it("returns 0 with no entries", () => {
    expect(sumHoursToday([], T("2026-07-10T13:00:00Z"))).toBe(0);
  });
});
