// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createFixture, createShiftAt, destroyFixture, type Fixture } from "./helpers/factory";
import { entryHours, getTimesheetWeekData, LATE_GRACE_MS, timesheetsToCsv } from "@/lib/timesheet-data";
import { localToUtc, weekStartOf } from "@/lib/time";

// A fixed Monday in the fixture timezone (America/New_York).
const WEEK = "2026-07-06";
// 09:00 local on WEEK, as a UTC instant.
function at(dateISO: string, hour: number, minute = 0): Date {
  return localToUtc(dateISO, { hour, minute }, "America/New_York");
}

describe("entryHours", () => {
  it("returns 0 for an open entry", () => {
    expect(entryHours(new Date(), null)).toBe(0);
  });
  it("rounds to one decimal", () => {
    const a = at(WEEK, 9);
    const b = at(WEEK, 12, 30);
    expect(entryHours(a, b)).toBe(3.5);
  });
  it("sums a cross-midnight span correctly", () => {
    const a = at(WEEK, 22); // 10 PM
    const b = at("2026-07-07", 2); // 2 AM next day
    expect(entryHours(a, b)).toBe(4);
  });
});

describe("getTimesheetWeekData", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();

    // Ana: on-time completed 09:00–17:00 (8h) matched to a shift.
    const anaShift = await createShiftAt(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      startsAt: at(WEEK, 9),
      endsAt: at(WEEK, 17),
    });
    await prisma.timeClockEntry.create({
      data: {
        employeeProfileId: f.ana.profileId,
        locationId: f.locationId,
        shiftId: anaShift.id,
        clockInAt: at(WEEK, 9),
        clockOutAt: at(WEEK, 17),
      },
    });
    // Ana rate → labor cost is computable.
    await prisma.employeeProfile.update({
      where: { id: f.ana.profileId },
      data: { hourlyRate: 20 },
    });

    // Ben: LATE (matched shift starts 09:00, clock-in 09:10) + an INCOMPLETE entry.
    const benShift = await createShiftAt(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ben.profileId,
      startsAt: at("2026-07-07", 9),
      endsAt: at("2026-07-07", 17),
    });
    await prisma.timeClockEntry.create({
      data: {
        employeeProfileId: f.ben.profileId,
        locationId: f.locationId,
        shiftId: benShift.id,
        clockInAt: at("2026-07-07", 9, 10), // 10 min late
        clockOutAt: at("2026-07-07", 17),
      },
    });
    await prisma.timeClockEntry.create({
      data: {
        employeeProfileId: f.ben.profileId,
        locationId: f.locationId,
        clockInAt: at("2026-07-08", 9),
        clockOutAt: null, // incomplete
      },
    });

    // Cal: NO-SHOW — an assigned published shift this week with no entry.
    await createShiftAt(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.cal.profileId,
      startsAt: at("2026-07-09", 9),
      endsAt: at("2026-07-09", 17),
    });
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("computes hours, cost, and reconciliation flags per employee", async () => {
    expect(weekStartOf(at(WEEK, 9), f.timezone)).toBe(WEEK); // sanity: WEEK is the Monday
    const data = await getTimesheetWeekData(f.locationId, WEEK);
    expect(data.weekStart).toBe(WEEK);
    expect(data.overtimeHoursPerWeek).toBe(40);

    const byName = Object.fromEntries(data.employees.map((e) => [e.name, e]));

    const ana = byName["Ana Diaz"];
    expect(ana.hoursActual).toBe(8);
    expect(ana.laborCost).toBe(160); // 8 * 20
    expect(ana.lateCount).toBe(0);
    expect(ana.noShowCount).toBe(0);
    expect(ana.overtime).toBe(false);
    expect(ana.entries).toHaveLength(1);
    expect(ana.entries[0].late).toBe(false);
    expect(ana.entries[0].incomplete).toBe(false);
    expect(ana.entries[0].shiftLabel).not.toBeNull();

    const ben = byName["Ben Cho"];
    expect(ben.hoursActual).toBe(7.8); // 09:10-17:00 (10 min late) = 7h50m; incomplete entry excluded from the total
    expect(ben.laborCost).toBeNull(); // no rate
    expect(ben.lateCount).toBe(1);
    expect(ben.entries).toHaveLength(2);
    const late = ben.entries.find((e) => e.late);
    expect(late?.late).toBe(true);
    const open = ben.entries.find((e) => e.incomplete);
    expect(open?.hours).toBe(0);

    const cal = byName["Cal Ito"];
    expect(cal.noShowCount).toBe(1);
    expect(cal.entries).toHaveLength(0);
  });

  it("exposes LATE_GRACE_MS as five minutes", () => {
    expect(LATE_GRACE_MS).toBe(5 * 60 * 1000);
  });
});

describe("timesheetsToCsv", () => {
  it("emits a header and one row per entry with quoted fields", () => {
    const csv = timesheetsToCsv({
      weekStart: "2026-07-06",
      overtimeHoursPerWeek: 40,
      employees: [
        {
          profileId: "p1",
          name: "Ana, Diaz",
          primaryPositionName: "Server",
          hourlyRate: 20,
          hoursActual: 8,
          laborCost: 160,
          lateCount: 0,
          noShowCount: 0,
          overtime: false,
          entries: [
            {
              id: "e1",
              date: "2026-07-06",
              clockInAt: "2026-07-06T13:00:00.000Z",
              clockOutAt: "2026-07-06T21:00:00.000Z",
              hours: 8,
              shiftId: "s1",
              shiftLabel: "9:00 AM – 5:00 PM",
              incomplete: false,
              late: false,
              edited: true,
            },
          ],
        },
      ],
    });
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("Employee,Date,Clock in,Clock out,Hours,Cost,Flags");
    // Name has a comma → must be quoted.
    expect(lines[1]).toContain('"Ana, Diaz"');
    expect(lines[1]).toContain("2026-07-06");
    expect(lines[1]).toContain("8");
    expect(lines[1]).toContain("edited");
  });

  it("marks an incomplete entry and a no-rate cost blank", () => {
    const csv = timesheetsToCsv({
      weekStart: "2026-07-06",
      overtimeHoursPerWeek: null,
      employees: [
        {
          profileId: "p2",
          name: "Ben Cho",
          primaryPositionName: null,
          hourlyRate: null,
          hoursActual: 0,
          laborCost: null,
          lateCount: 0,
          noShowCount: 0,
          overtime: false,
          entries: [
            {
              id: "e2",
              date: "2026-07-06",
              clockInAt: "2026-07-06T13:00:00.000Z",
              clockOutAt: null,
              hours: 0,
              shiftId: null,
              shiftLabel: null,
              incomplete: true,
              late: false,
              edited: false,
            },
          ],
        },
      ],
    });
    const row = csv.trim().split("\n")[1];
    expect(row).toContain("incomplete");
    // Cost column blank (two commas around it): ...,,... with no number.
    expect(row.split(",").includes("")).toBe(true);
  });
});
