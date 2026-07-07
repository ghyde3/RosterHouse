import { describe, expect, it } from "vitest";
import { detectConflicts, type ConflictContext, type ProposedShift } from "@/lib/conflicts";
import { parseTime12h, shiftInstants, type ISODate } from "@/lib/time";

const NY = "America/New_York";

/** Build UTC instants for a shift from 12-hour strings, New York wall clock. */
function instants(date: ISODate, start: string, end: string) {
  return shiftInstants(date, parseTime12h(start)!, parseTime12h(end)!, NY);
}

function proposed(
  date: ISODate, start: string, end: string,
  overrides: Partial<ProposedShift> = {},
): ProposedShift {
  return { employeeProfileId: "ep-1", date, ...instants(date, start, end), ...overrides };
}

function existingShift(
  id: string, date: ISODate, start: string, end: string, positionName = "Server",
) {
  return { id, positionName, ...instants(date, start, end) };
}

/** Shape of ConflictContext.priorShifts entries (no positionName). */
function priorShift(id: string, date: ISODate, start: string, end: string) {
  return { id, ...instants(date, start, end) };
}

function ctx(overrides: Partial<ConflictContext> = {}): ConflictContext {
  return {
    timezone: NY,
    employeeName: "Maria Garcia",
    employeeShifts: [],
    availability: [],
    approvedTimeOff: [],
    overtimeHoursPerWeek: null,
    ...overrides,
  };
}

describe("insufficient_rest", () => {
  it("flags a too-short gap with the pinned message copy", () => {
    const c = ctx({
      minRestHours: 10,
      employeeShifts: [existingShift("s1", "2026-07-07", "3:00 PM", "11:00 PM")],
    });
    expect(detectConflicts(proposed("2026-07-08", "7:00 AM", "3:00 PM"), c)).toEqual([
      {
        kind: "insufficient_rest",
        message: "Maria Garcia has only 8h rest before this shift (needs 10h).",
      },
    ]);
  });

  it("exactly-enough rest is not flagged", () => {
    // Ends 9:00 PM, next starts 7:00 AM = exactly 10h.
    const c = ctx({
      minRestHours: 10,
      employeeShifts: [existingShift("s1", "2026-07-07", "1:00 PM", "9:00 PM")],
    });
    expect(detectConflicts(proposed("2026-07-08", "7:00 AM", "3:00 PM"), c)).toEqual([]);
  });

  it("null minRestHours turns rest checks off", () => {
    const c = ctx({
      minRestHours: null,
      employeeShifts: [existingShift("s1", "2026-07-07", "3:00 PM", "11:00 PM")],
    });
    expect(detectConflicts(proposed("2026-07-08", "1:00 AM", "9:00 AM"), c)).toEqual([]);
  });

  it("handles a midnight-crossing previous shift via real instants", () => {
    // Friday 6:00 PM – 2:00 AM ends Saturday 2:00 AM; Saturday 8:00 AM start
    // leaves only 6h even though the shifts have different service dates.
    const c = ctx({
      minRestHours: 10,
      employeeShifts: [existingShift("s1", "2026-07-10", "6:00 PM", "2:00 AM")],
    });
    expect(detectConflicts(proposed("2026-07-11", "8:00 AM", "4:00 PM"), c)).toEqual([
      {
        kind: "insufficient_rest",
        message: "Maria Garcia has only 6h rest before this shift (needs 10h).",
      },
    ]);
  });

  it("counts a prior-week shift (priorShifts) before a Monday opener", () => {
    // Sunday closer 3:00 PM – 11:00 PM, Monday 7:00 AM opener = 8h.
    const c = ctx({
      minRestHours: 10,
      priorShifts: [priorShift("p1", "2026-07-05", "3:00 PM", "11:00 PM")],
    });
    expect(detectConflicts(proposed("2026-07-06", "7:00 AM", "3:00 PM"), c)).toEqual([
      {
        kind: "insufficient_rest",
        message: "Maria Garcia has only 8h rest before this shift (needs 10h).",
      },
    ]);
  });

  it("a prior-week overlap (priorShifts) is double_booked, not insufficient_rest", () => {
    // Sunday closer 6:00 PM – 2:00 AM (prior week) ends Monday 2:00 AM; a
    // Monday 1:30 AM opener OVERLAPS it across the week boundary. That must
    // surface as double_booked — the rest rule deliberately skips overlaps,
    // so before priorShifts fed the double-booking scan this case escaped
    // both rules entirely.
    const c = ctx({
      minRestHours: 10,
      priorShifts: [priorShift("p1", "2026-07-05", "6:00 PM", "2:00 AM")],
    });
    const kinds = detectConflicts(proposed("2026-07-06", "1:30 AM", "9:30 AM"), c)
      .map((x) => x.kind);
    expect(kinds).toEqual(["double_booked"]);
  });

  it("a prior-week closer followed 30 min later is still a rest violation", () => {
    // Same Sunday closer, but the Monday shift starts 2:30 AM — just after
    // the closer ends, so there is no overlap: insufficient_rest applies,
    // not double_booked.
    const c = ctx({
      minRestHours: 10,
      priorShifts: [priorShift("p1", "2026-07-05", "6:00 PM", "2:00 AM")],
    });
    expect(detectConflicts(proposed("2026-07-06", "2:30 AM", "10:30 AM"), c)).toEqual([
      {
        kind: "insufficient_rest",
        message: "Maria Garcia has only 0.5h rest before this shift (needs 10h).",
      },
    ]);
  });

  it("an overlapping earlier shift is double_booked, not a rest violation", () => {
    const c = ctx({
      minRestHours: 10,
      employeeShifts: [existingShift("s1", "2026-07-08", "9:00 AM", "5:00 PM")],
    });
    const kinds = detectConflicts(proposed("2026-07-08", "4:00 PM", "10:00 PM"), c)
      .map((x) => x.kind);
    expect(kinds).toEqual(["double_booked"]);
  });

  it("editing excludes the shift's own previous instants", () => {
    const c = ctx({
      minRestHours: 10,
      employeeShifts: [existingShift("s1", "2026-07-08", "7:00 AM", "3:00 PM")],
    });
    // Re-saving s1 later the same day: only itself precedes it, so no flag.
    expect(
      detectConflicts(proposed("2026-07-08", "5:00 PM", "11:00 PM", { shiftId: "s1" }), c),
    ).toEqual([]);
  });
});

describe("consecutive_days", () => {
  /** One 9-5 shift per date, ids d1..dN. */
  function dailyShifts(dates: ISODate[]) {
    return dates.map((date, i) => existingShift(`d${i + 1}`, date, "9:00 AM", "5:00 PM"));
  }

  it("a run over the limit flags with the pinned message copy", () => {
    // Mon 2026-07-06 .. Sat 2026-07-11 scheduled; Sunday is day 7 of the run.
    const c = ctx({
      maxConsecutiveDays: 6,
      employeeShifts: dailyShifts([
        "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11",
      ]),
    });
    expect(detectConflicts(proposed("2026-07-12", "9:00 AM", "5:00 PM"), c)).toEqual([
      {
        kind: "consecutive_days",
        message: "Maria Garcia is scheduled 7 days in a row (limit 6).",
      },
    ]);
  });

  it("flags only the shifts beyond the limit in an 8-day run", () => {
    const dates: ISODate[] = [
      "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09",
      "2026-07-10", "2026-07-11", "2026-07-12", "2026-07-13",
    ];
    const c = ctx({ maxConsecutiveDays: 6, employeeShifts: dailyShifts(dates) });
    const at = (date: ISODate, shiftId: string) =>
      detectConflicts(proposed(date, "9:00 AM", "5:00 PM", { shiftId }), c);
    // Day 6 of the run is clean; days 7 and 8 flag with their running counts.
    expect(at("2026-07-11", "d6")).toEqual([]);
    expect(at("2026-07-12", "d7")).toEqual([
      { kind: "consecutive_days", message: "Maria Garcia is scheduled 7 days in a row (limit 6)." },
    ]);
    expect(at("2026-07-13", "d8")).toEqual([
      { kind: "consecutive_days", message: "Maria Garcia is scheduled 8 days in a row (limit 6)." },
    ]);
  });

  it("a run equal to the limit is clean", () => {
    const c = ctx({
      maxConsecutiveDays: 6,
      employeeShifts: dailyShifts([
        "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10",
      ]),
    });
    // Saturday is day 6 exactly.
    expect(detectConflicts(proposed("2026-07-11", "9:00 AM", "5:00 PM"), c)).toEqual([]);
  });

  it("null maxConsecutiveDays turns consecutive checks off", () => {
    const c = ctx({
      maxConsecutiveDays: null,
      employeeShifts: dailyShifts([
        "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11",
      ]),
    });
    expect(detectConflicts(proposed("2026-07-12", "9:00 AM", "5:00 PM"), c)).toEqual([]);
  });

  it("a gap day resets the run", () => {
    // Mon-Wed scheduled, Thursday off, Fri-Sat scheduled: Sunday is only day 3
    // of the second run, so limit 3 stays clean.
    const c = ctx({
      maxConsecutiveDays: 3,
      employeeShifts: dailyShifts([
        "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-10", "2026-07-11",
      ]),
    });
    expect(detectConflicts(proposed("2026-07-12", "9:00 AM", "5:00 PM"), c)).toEqual([]);
  });

  it("two shifts on one date count as one scheduled day", () => {
    const c = ctx({
      maxConsecutiveDays: 3,
      employeeShifts: [
        existingShift("a1", "2026-07-08", "7:00 AM", "11:00 AM"),
        existingShift("a2", "2026-07-08", "12:00 PM", "4:00 PM"),
        existingShift("a3", "2026-07-09", "9:00 AM", "5:00 PM"),
      ],
    });
    // 07-08 (once) + 07-09 + proposed 07-10 = a 3-day run at limit 3: clean.
    expect(detectConflicts(proposed("2026-07-10", "9:00 AM", "5:00 PM"), c)).toEqual([]);
  });

  it("prior-week days (priorShifts) extend the run across the week edge", () => {
    // Sat 07-04 and Sun 07-05 from the previous week + Mon 07-06 make the
    // proposed Tuesday day 4 of the run.
    const c = ctx({
      maxConsecutiveDays: 3,
      priorShifts: [
        priorShift("p1", "2026-07-04", "9:00 AM", "5:00 PM"),
        priorShift("p2", "2026-07-05", "9:00 AM", "5:00 PM"),
      ],
      employeeShifts: dailyShifts(["2026-07-06"]),
    });
    expect(detectConflicts(proposed("2026-07-07", "9:00 AM", "5:00 PM"), c)).toEqual([
      {
        kind: "consecutive_days",
        message: "Maria Garcia is scheduled 4 days in a row (limit 3).",
      },
    ]);
  });
});
