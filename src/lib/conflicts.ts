import {
  DAY_NAMES_MON0,
  dayOfWeekMon0,
  formatDateShort,
  formatShiftRange,
  formatTimeHM,
  localISODate,
  localTimeOfDay,
  shiftDurationHours,
  type ISODate,
} from "@/lib/time";

export type ConflictKind = "double_booked" | "outside_availability" | "overtime";

export type Conflict = { kind: ConflictKind; message: string };

export type ProposedShift = {
  shiftId?: string;                 // exclude self when editing
  employeeProfileId: string | null; // null (open shift) → no conflicts
  date: ISODate;
  startsAt: Date;
  endsAt: Date;
};

export type ConflictContext = {
  timezone: string;
  employeeName: string;
  /** All of this employee's shifts in the same week (any position). */
  employeeShifts: { id: string; startsAt: Date; endsAt: Date; positionName: string }[];
  availability: {
    dayOfWeek: number; // 0=Mon..6=Sun
    isAvailable: boolean;
    startTime: string | null; // "09:00" location-local; null = all day
    endTime: string | null;
  }[];
  approvedTimeOff: { startDate: ISODate; endDate: ISODate }[];
  overtimeHoursPerWeek: number | null; // null = OT checks off
};

function minutesOf(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Compute conflicts for a proposed shift. Pure — callers assemble the
 * ConflictContext (see buildConflictContext in @/lib/conflict-context).
 * Order: double_booked, then outside_availability (weekly rule, then
 * approved time off), then overtime.
 */
export function detectConflicts(shift: ProposedShift, ctx: ConflictContext): Conflict[] {
  if (shift.employeeProfileId === null) return [];

  const conflicts: Conflict[] = [];
  const otherShifts = ctx.employeeShifts.filter((s) => s.id !== shift.shiftId);

  // 1. Double-booked. Strict inequality: back-to-back shifts
  //    (3:00 PM end vs 3:00 PM start) do not overlap.
  for (const other of otherShifts) {
    if (shift.startsAt < other.endsAt && other.startsAt < shift.endsAt) {
      conflicts.push({
        kind: "double_booked",
        message: `Overlaps ${ctx.employeeName}'s ${formatShiftRange(
          other.startsAt, other.endsAt, ctx.timezone,
        )} ${other.positionName} shift`,
      });
    }
  }

  // 2. Outside availability — weekly rule for the shift's service day.
  //    No rule for that weekday means available all day.
  const dow = dayOfWeekMon0(shift.date);
  const dayName = DAY_NAMES_MON0[dow];
  const rule = ctx.availability.find((r) => r.dayOfWeek === dow);
  if (rule && !rule.isAvailable) {
    conflicts.push({
      kind: "outside_availability",
      message: `${ctx.employeeName} isn't available ${dayName}s`,
    });
  } else if (rule && rule.isAvailable && rule.startTime && rule.endTime) {
    const windowStart = minutesOf(rule.startTime);
    const windowEnd = minutesOf(rule.endTime);
    const start = localTimeOfDay(shift.startsAt, ctx.timezone);
    const startMin = start.hour * 60 + start.minute;
    const crossesMidnight = localISODate(shift.endsAt, ctx.timezone) !== shift.date;
    const end = localTimeOfDay(shift.endsAt, ctx.timezone);
    const endMin = crossesMidnight ? 24 * 60 : end.hour * 60 + end.minute;
    if (startMin < windowStart || endMin > windowEnd) {
      conflicts.push({
        kind: "outside_availability",
        message: `${ctx.employeeName} is only available ${formatTimeHM(rule.startTime)} – ${formatTimeHM(rule.endTime)} on ${dayName}s`,
      });
    }
  }

  // 3. Approved time off (ISODate strings compare lexicographically).
  for (const timeOff of ctx.approvedTimeOff) {
    if (shift.date >= timeOff.startDate && shift.date <= timeOff.endDate) {
      const range =
        timeOff.startDate === timeOff.endDate
          ? formatDateShort(timeOff.startDate)
          : `${formatDateShort(timeOff.startDate)} – ${formatDateShort(timeOff.endDate)}`;
      conflicts.push({
        kind: "outside_availability",
        message: `${ctx.employeeName} has approved time off ${range}`,
      });
    }
  }

  // 4. Overtime — "over" means strictly above the threshold.
  if (ctx.overtimeHoursPerWeek !== null) {
    const existingHours = otherShifts.reduce(
      (sum, s) => sum + shiftDurationHours(s.startsAt, s.endsAt), 0,
    );
    const totalHours = existingHours + shiftDurationHours(shift.startsAt, shift.endsAt);
    if (totalHours > ctx.overtimeHoursPerWeek) {
      conflicts.push({
        kind: "overtime",
        message: `Would put ${ctx.employeeName} over ${ctx.overtimeHoursPerWeek} hrs this week`,
      });
    }
  }

  return conflicts;
}
