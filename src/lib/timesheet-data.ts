// src/lib/timesheet-data.ts — read-time weekly timesheet + reconciliation.
// Nothing here is stored: hours and the no-show/late/overtime flags are all
// derived on each read (mirrors the conflicts engine).
import { prisma } from "@/lib/db";
import {
  addDaysISO,
  formatShiftRange,
  localISODate,
  localToUtc,
  weekDatesOf,
  type ISODate,
} from "@/lib/time";

/** Fixed grace window: a matched clock-in later than start + 5 min is "late". */
export const LATE_GRACE_MS = 5 * 60 * 1000;

export type TimesheetEntry = {
  id: string;
  date: ISODate;
  clockInAt: string;
  clockOutAt: string | null;
  hours: number;
  shiftId: string | null;
  shiftLabel: string | null;
  incomplete: boolean;
  late: boolean;
  edited: boolean;
};

export type TimesheetEmployee = {
  profileId: string;
  name: string;
  primaryPositionName: string | null;
  hourlyRate: number | null;
  entries: TimesheetEntry[];
  hoursActual: number;
  laborCost: number | null;
  lateCount: number;
  noShowCount: number;
  overtime: boolean;
};

export type TimesheetWeekData = {
  weekStart: ISODate;
  overtimeHoursPerWeek: number | null;
  employees: TimesheetEmployee[];
};

/** Interval hours, 1-dp; an open entry (no clock-out) is 0. Mirrors sumHoursToday. */
export function entryHours(clockInAt: Date, clockOutAt: Date | null): number {
  if (clockOutAt === null) return 0;
  const ms = clockOutAt.getTime() - clockInAt.getTime();
  return Math.round((ms / 3_600_000) * 10) / 10;
}

export async function getTimesheetWeekData(
  locationId: string,
  weekStart: ISODate,
): Promise<TimesheetWeekData> {
  const location = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
  const tz = location.timezone;
  const dates = weekDatesOf(weekStart);
  // Fetch entries whose clock-in falls inside the local week [Mon 00:00, next Mon 00:00),
  // evaluated in the location's own timezone (clockInAt is a real instant).
  const weekStartInstant = localToUtc(weekStart, { hour: 0, minute: 0 }, tz);
  const weekEndInstant = localToUtc(addDaysISO(weekStart, 7), { hour: 0, minute: 0 }, tz);
  // The @db.Date shift column is stored UTC-midnight, so bound by date value.
  const shiftDateLo = new Date(`${weekStart}T00:00:00.000Z`);
  const shiftDateHi = new Date(`${dates[6]}T00:00:00.000Z`);

  const [profiles, entries, shifts] = await Promise.all([
    prisma.employeeProfile.findMany({
      where: { locationId, status: "active" },
      include: { user: true, primaryPosition: true },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.timeClockEntry.findMany({
      where: {
        locationId,
        clockInAt: { gte: weekStartInstant, lt: weekEndInstant },
      },
      include: { shift: true },
      orderBy: { clockInAt: "asc" },
    }),
    prisma.shift.findMany({
      where: {
        locationId,
        status: "published",
        employeeProfileId: { not: null },
        date: { gte: shiftDateLo, lte: shiftDateHi },
      },
    }),
  ]);

  // Entries grouped by employee.
  const entriesByProfile = new Map<string, typeof entries>();
  for (const e of entries) {
    const list = entriesByProfile.get(e.employeeProfileId) ?? [];
    list.push(e);
    entriesByProfile.set(e.employeeProfileId, list);
  }
  // Which published-shift ids actually have an entry pointing at them.
  const coveredShiftIds = new Set(
    entries.map((e) => e.shiftId).filter((id): id is string => id !== null),
  );
  // Assigned published shifts grouped by employee (for no-show counting).
  const shiftsByProfile = new Map<string, typeof shifts>();
  for (const s of shifts) {
    if (s.employeeProfileId === null) continue;
    const list = shiftsByProfile.get(s.employeeProfileId) ?? [];
    list.push(s);
    shiftsByProfile.set(s.employeeProfileId, list);
  }

  const employees: TimesheetEmployee[] = profiles.map((p) => {
    const rate = p.hourlyRate === null ? null : Number(p.hourlyRate);
    const raw = entriesByProfile.get(p.id) ?? [];
    const entriesOut: TimesheetEntry[] = raw.map((e) => {
      const hours = entryHours(e.clockInAt, e.clockOutAt);
      const late =
        e.shift !== null &&
        e.clockInAt.getTime() > e.shift.startsAt.getTime() + LATE_GRACE_MS;
      return {
        id: e.id,
        date: localISODate(e.clockInAt, tz),
        clockInAt: e.clockInAt.toISOString(),
        clockOutAt: e.clockOutAt ? e.clockOutAt.toISOString() : null,
        hours,
        shiftId: e.shiftId,
        shiftLabel: e.shift ? formatShiftRange(e.shift.startsAt, e.shift.endsAt, tz) : null,
        incomplete: e.clockOutAt === null,
        late,
        edited: e.editedAt !== null,
      };
    });

    const hoursActual =
      Math.round(
        entriesOut.filter((e) => !e.incomplete).reduce((sum, e) => sum + e.hours, 0) * 10,
      ) / 10;
    const laborCost = rate === null ? null : Math.round(hoursActual * rate * 100) / 100;
    const lateCount = entriesOut.filter((e) => e.late).length;
    const assignedShifts = shiftsByProfile.get(p.id) ?? [];
    const noShowCount = assignedShifts.filter((s) => !coveredShiftIds.has(s.id)).length;
    const overtime =
      location.overtimeHoursPerWeek !== null &&
      hoursActual > location.overtimeHoursPerWeek;

    return {
      profileId: p.id,
      name: p.user.name,
      primaryPositionName: p.primaryPosition?.name ?? null,
      hourlyRate: rate,
      entries: entriesOut,
      hoursActual,
      laborCost,
      lateCount,
      noShowCount,
      overtime,
    };
  });

  return { weekStart, overtimeHoursPerWeek: location.overtimeHoursPerWeek, employees };
}

/** RFC-4180 field: quote when it contains a comma, quote, or newline. */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** One header row + one row per entry across all employees. */
export function timesheetsToCsv(data: TimesheetWeekData): string {
  const header = ["Employee", "Date", "Clock in", "Clock out", "Hours", "Cost", "Flags"];
  const rows: string[] = [header.join(",")];
  for (const emp of data.employees) {
    for (const e of emp.entries) {
      const flags: string[] = [];
      if (e.incomplete) flags.push("incomplete");
      if (e.late) flags.push("late");
      if (e.edited) flags.push("edited");
      const cost =
        e.incomplete || emp.hourlyRate === null
          ? ""
          : String(Math.round(e.hours * emp.hourlyRate * 100) / 100);
      rows.push(
        [
          csvField(emp.name),
          e.date,
          e.clockInAt,
          e.clockOutAt ?? "",
          String(e.hours),
          cost,
          csvField(flags.join(" ")),
        ].join(","),
      );
    }
  }
  return rows.join("\n") + "\n";
}
