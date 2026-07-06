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
  id: string, date: ISODate, start: string, end: string, positionName: string,
) {
  return { id, positionName, ...instants(date, start, end) };
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

describe("open shifts", () => {
  it("null employeeProfileId never conflicts, even with overlapping shifts", () => {
    const c = ctx({ employeeShifts: [existingShift("s1", "2026-07-08", "2:00 PM", "6:00 PM", "Server")] });
    expect(detectConflicts(proposed("2026-07-08", "3:00 PM", "9:00 PM", { employeeProfileId: null }), c)).toEqual([]);
  });
});

describe("double_booked", () => {
  it("flags an overlap with the pinned message copy", () => {
    const c = ctx({ employeeShifts: [existingShift("s1", "2026-07-08", "2:00 PM", "6:00 PM", "Server")] });
    const conflicts = detectConflicts(proposed("2026-07-08", "5:00 PM", "11:00 PM"), c);
    expect(conflicts).toEqual([
      { kind: "double_booked", message: "Overlaps Maria Garcia's 2:00 PM – 6:00 PM Server shift" },
    ]);
  });

  it("exact-boundary shifts do NOT conflict (3:00 PM end vs 3:00 PM start)", () => {
    const c = ctx({ employeeShifts: [existingShift("s1", "2026-07-08", "7:00 AM", "3:00 PM", "Line cook")] });
    expect(detectConflicts(proposed("2026-07-08", "3:00 PM", "11:00 PM"), c)).toEqual([]);
  });

  it("editing a shift excludes itself from overlap checks", () => {
    const c = ctx({ employeeShifts: [existingShift("s1", "2026-07-08", "2:00 PM", "6:00 PM", "Server")] });
    expect(detectConflicts(proposed("2026-07-08", "2:00 PM", "6:00 PM", { shiftId: "s1" }), c)).toEqual([]);
  });

  it("catches overlaps across midnight (instants, not same-day strings)", () => {
    // Existing Friday 6:00 PM – 2:00 AM crosses into Saturday.
    const c = ctx({ employeeShifts: [existingShift("s1", "2026-07-10", "6:00 PM", "2:00 AM", "Dishwasher")] });
    const conflicts = detectConflicts(proposed("2026-07-11", "1:00 AM", "9:00 AM"), c);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("double_booked");
  });
});

describe("outside_availability", () => {
  it("day off: pinned message copy", () => {
    const c = ctx({
      employeeName: "Sam Torres",
      availability: [{ dayOfWeek: 0, isAvailable: false, startTime: null, endTime: null }],
    });
    // 2026-07-06 is a Monday
    expect(detectConflicts(proposed("2026-07-06", "9:00 AM", "5:00 PM"), c)).toEqual([
      { kind: "outside_availability", message: "Sam Torres isn't available Mondays" },
    ]);
  });

  it("partial window: shift ending after the window conflicts", () => {
    const c = ctx({
      employeeName: "Sam Torres",
      availability: [{ dayOfWeek: 1, isAvailable: true, startTime: "09:00", endTime: "15:00" }],
    });
    // 2026-07-07 is a Tuesday; 11:00 AM – 4:00 PM ends after 3:00 PM
    expect(detectConflicts(proposed("2026-07-07", "11:00 AM", "4:00 PM"), c)).toEqual([
      { kind: "outside_availability", message: "Sam Torres is only available 9:00 AM – 3:00 PM on Tuesdays" },
    ]);
  });

  it("a shift fully inside the window does not conflict", () => {
    const c = ctx({
      availability: [{ dayOfWeek: 1, isAvailable: true, startTime: "09:00", endTime: "15:00" }],
    });
    expect(detectConflicts(proposed("2026-07-07", "9:00 AM", "3:00 PM"), c)).toEqual([]);
  });

  it("a midnight-crossing shift is outside any same-day window", () => {
    const c = ctx({
      availability: [{ dayOfWeek: 1, isAvailable: true, startTime: "09:00", endTime: "23:00" }],
    });
    const conflicts = detectConflicts(proposed("2026-07-07", "5:00 PM", "12:00 AM"), c);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("outside_availability");
  });

  it("no rule for that weekday means available all day", () => {
    const c = ctx({ availability: [{ dayOfWeek: 3, isAvailable: false, startTime: null, endTime: null }] });
    expect(detectConflicts(proposed("2026-07-06", "9:00 AM", "5:00 PM"), c)).toEqual([]);
  });
});

describe("approved time off", () => {
  it("renders as outside_availability with the date range", () => {
    const c = ctx({ approvedTimeOff: [{ startDate: "2026-07-14", endDate: "2026-07-16" }] });
    expect(detectConflicts(proposed("2026-07-15", "9:00 AM", "5:00 PM"), c)).toEqual([
      { kind: "outside_availability", message: "Maria Garcia has approved time off Jul 14 – Jul 16" },
    ]);
  });

  it("single-day time off renders one date", () => {
    const c = ctx({ approvedTimeOff: [{ startDate: "2026-07-20", endDate: "2026-07-20" }] });
    expect(detectConflicts(proposed("2026-07-20", "9:00 AM", "5:00 PM"), c)).toEqual([
      { kind: "outside_availability", message: "Maria Garcia has approved time off Jul 20" },
    ]);
  });

  it("shifts outside the range are unaffected", () => {
    const c = ctx({ approvedTimeOff: [{ startDate: "2026-07-14", endDate: "2026-07-16" }] });
    expect(detectConflicts(proposed("2026-07-17", "9:00 AM", "5:00 PM"), c)).toEqual([]);
  });
});

describe("overtime", () => {
  const fourEightHourShifts = [
    existingShift("s1", "2026-07-06", "7:00 AM", "3:00 PM", "Line cook"),
    existingShift("s2", "2026-07-07", "7:00 AM", "3:00 PM", "Line cook"),
    existingShift("s3", "2026-07-08", "7:00 AM", "3:00 PM", "Line cook"),
    existingShift("s4", "2026-07-09", "7:00 AM", "3:00 PM", "Line cook"),
  ]; // 32 hrs

  it("crossing the threshold mid-week flags with the pinned copy", () => {
    const c = ctx({
      employeeName: "Alex Kim",
      overtimeHoursPerWeek: 40,
      employeeShifts: [
        ...fourEightHourShifts,
        existingShift("s5", "2026-07-10", "7:00 AM", "11:00 AM", "Line cook"), // +4 = 36 hrs
      ],
    });
    // Proposing 8 more hrs → 44 total
    expect(detectConflicts(proposed("2026-07-11", "7:00 AM", "3:00 PM"), c)).toEqual([
      { kind: "overtime", message: "Would put Alex Kim over 40 hrs this week" },
    ]);
  });

  it("landing exactly on the threshold is not overtime", () => {
    const c = ctx({ overtimeHoursPerWeek: 40, employeeShifts: fourEightHourShifts }); // 32 hrs
    expect(detectConflicts(proposed("2026-07-10", "7:00 AM", "3:00 PM"), c)).toEqual([]); // = 40
  });

  it("null threshold disables overtime checks entirely", () => {
    const c = ctx({
      overtimeHoursPerWeek: null,
      employeeShifts: [
        ...fourEightHourShifts,
        existingShift("s5", "2026-07-10", "7:00 AM", "11:00 PM", "Line cook"),
      ],
    });
    expect(detectConflicts(proposed("2026-07-11", "7:00 AM", "3:00 PM"), c)).toEqual([]);
  });

  it("editing excludes the shift's own hours from the running total", () => {
    const c = ctx({
      overtimeHoursPerWeek: 40,
      employeeShifts: [
        ...fourEightHourShifts,
        existingShift("s5", "2026-07-10", "7:00 AM", "3:00 PM", "Line cook"), // 40 total incl. s5
      ],
    });
    // Re-saving s5 unchanged: 32 existing (s5 excluded) + 8 proposed = 40, not over
    expect(detectConflicts(proposed("2026-07-10", "7:00 AM", "3:00 PM", { shiftId: "s5" }), c)).toEqual([]);
  });
});

describe("stacking", () => {
  it("reports multiple kinds at once, double_booked first", () => {
    const c = ctx({
      overtimeHoursPerWeek: 40,
      employeeShifts: [
        existingShift("s1", "2026-07-06", "7:00 AM", "3:00 PM", "Line cook"),
        existingShift("s2", "2026-07-07", "7:00 AM", "11:00 PM", "Line cook"),
        existingShift("s3", "2026-07-08", "7:00 AM", "11:00 PM", "Line cook"),
      ], // 8 + 16 + 16 = 40 hrs
      approvedTimeOff: [{ startDate: "2026-07-06", endDate: "2026-07-06" }],
    });
    const conflicts = detectConflicts(proposed("2026-07-06", "2:00 PM", "6:00 PM"), c);
    expect(conflicts.map((x) => x.kind)).toEqual([
      "double_booked", "outside_availability", "overtime",
    ]);
  });
});
