import {
  DAY_NAMES_MON0,
  addDaysISO,
  dayOfWeekMon0,
  formatDateShort,
  formatShiftRange,
  formatTimeHM,
  localISODate,
  localTimeOfDay,
  shiftDurationHours,
  type ISODate,
} from "@/lib/time";

export type ConflictKind =
  | "double_booked"
  | "outside_availability"
  | "overtime"
  | "insufficient_rest"
  | "consecutive_days";

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
  /**
   * One-off per-date overrides. An entry whose date matches the proposed
   * shift's service date WINS over the weekly rule: isAvailable=false means
   * unavailable all day; isAvailable=true with times means available only in
   * that window; isAvailable=true with null times means available all day.
   * Optional so existing callers that predate exceptions keep type-checking.
   */
  availabilityExceptions?: {
    date: ISODate;
    isAvailable: boolean;
    startTime: string | null; // "09:00" location-local; null = all day
    endTime: string | null;
  }[];
  overtimeHoursPerWeek: number | null; // null = OT checks off
  /**
   * Shifts from the lookback window just before the week — buildConflictContext
   * loads max(2, maxConsecutiveDays ?? 0) days before weekStart (see its doc).
   * Used ONLY by the rest and consecutive-days rules so the week-scoped rules
   * (double-booking, overtime) keep their existing semantics. Optional so
   * callers that predate the compliance rules keep type-checking.
   */
  priorShifts?: { id: string; startsAt: Date; endsAt: Date; positionName?: string }[];
  /** Required rest (hours) before a shift starts. null/undefined = checks off. */
  minRestHours?: number | null;
  /** Max run of consecutive scheduled days (distinct service dates). null/undefined = checks off. */
  maxConsecutiveDays?: number | null;
};

function minutesOf(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

/** True when the shift's local start/end falls outside an "HH:mm" window on its service date. */
function outsideWindow(
  shift: ProposedShift, startTime: string, endTime: string, timezone: string,
): boolean {
  const windowStart = minutesOf(startTime);
  const windowEnd = minutesOf(endTime);
  const start = localTimeOfDay(shift.startsAt, timezone);
  const startMin = start.hour * 60 + start.minute;
  const crossesMidnight = localISODate(shift.endsAt, timezone) !== shift.date;
  const end = localTimeOfDay(shift.endsAt, timezone);
  const endMin = crossesMidnight ? 24 * 60 : end.hour * 60 + end.minute;
  return startMin < windowStart || endMin > windowEnd;
}

/**
 * Compute conflicts for a proposed shift. Pure — callers assemble the
 * ConflictContext (see buildConflictContext in @/lib/conflict-context).
 * Order: double_booked, then outside_availability (one-off exception if one
 * exists for the date, else the weekly rule, then approved time off), then
 * overtime, then insufficient_rest, then consecutive_days.
 */
export function detectConflicts(shift: ProposedShift, ctx: ConflictContext): Conflict[] {
  if (shift.employeeProfileId === null) return [];

  const conflicts: Conflict[] = [];
  const otherShifts = ctx.employeeShifts.filter((s) => s.id !== shift.shiftId);

  // 1. Double-booked. Strict inequality: back-to-back shifts
  //    (3:00 PM end vs 3:00 PM start) do not overlap. Prior-week shifts
  //    count too — a Sunday closer that runs past midnight can overlap a
  //    Monday opener, and the rest rule deliberately skips overlaps.
  const otherPriorShifts = (ctx.priorShifts ?? []).filter((s) => s.id !== shift.shiftId);
  for (const other of [...otherShifts, ...otherPriorShifts]) {
    if (shift.startsAt < other.endsAt && other.startsAt < shift.endsAt) {
      const position = "positionName" in other && other.positionName ? `${other.positionName} ` : "";
      conflicts.push({
        kind: "double_booked",
        message: `Overlaps ${ctx.employeeName}'s ${formatShiftRange(
          other.startsAt, other.endsAt, ctx.timezone,
        )} ${position}shift`,
      });
    }
  }

  // 2. Outside availability — a one-off exception for the shift's service
  //    date wins over the weekly rule; otherwise the weekly rule applies.
  //    No exception and no rule for that weekday means available all day.
  const dow = dayOfWeekMon0(shift.date);
  const dayName = DAY_NAMES_MON0[dow];
  const exception = ctx.availabilityExceptions?.find((e) => e.date === shift.date);
  if (exception) {
    if (!exception.isAvailable) {
      conflicts.push({
        kind: "outside_availability",
        message: `${ctx.employeeName} isn't available on ${formatDateShort(shift.date)}`,
      });
    } else if (
      exception.startTime && exception.endTime &&
      outsideWindow(shift, exception.startTime, exception.endTime, ctx.timezone)
    ) {
      conflicts.push({
        kind: "outside_availability",
        message: `${ctx.employeeName} is only available ${formatTimeHM(exception.startTime)} – ${formatTimeHM(exception.endTime)} on ${formatDateShort(shift.date)}`,
      });
    }
  } else {
    const rule = ctx.availability.find((r) => r.dayOfWeek === dow);
    if (rule && !rule.isAvailable) {
      conflicts.push({
        kind: "outside_availability",
        message: `${ctx.employeeName} isn't available ${dayName}s`,
      });
    } else if (
      rule && rule.isAvailable && rule.startTime && rule.endTime &&
      outsideWindow(shift, rule.startTime, rule.endTime, ctx.timezone)
    ) {
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

  // 5. Insufficient rest — flagged on the LATER shift only. The "previous"
  //    shift is the one with the latest end at-or-before this shift's start;
  //    an overlapping earlier shift is double_booked's job, not a rest
  //    violation. Prior-week shifts (ctx.priorShifts) count, so a Sunday
  //    closer flags a too-early Monday opener.
  if (ctx.minRestHours != null) {
    const earlier = [...(ctx.priorShifts ?? []), ...otherShifts].filter(
      (s) => s.id !== shift.shiftId && s.endsAt <= shift.startsAt,
    );
    const previous = earlier.reduce<{ endsAt: Date } | null>(
      (latest, s) => (latest === null || s.endsAt > latest.endsAt ? s : latest),
      null,
    );
    if (previous) {
      const rest = shiftDurationHours(previous.endsAt, shift.startsAt);
      if (rest < ctx.minRestHours) {
        conflicts.push({
          kind: "insufficient_rest",
          message: `${ctx.employeeName} has only ${rest}h rest before this shift (needs ${ctx.minRestHours}h).`,
        });
      }
    }
  }

  // 6. Consecutive days — count the run of consecutive service dates ending
  //    at this shift's date (distinct dates; prior-week dates included).
  //    Only shifts BEYOND the limit flag: day `limit` of a run is clean, day
  //    `limit + 1` and later each flag with their own running count, so a run
  //    that grows to 8 days flags days 7 and 8 but leaves days 1-6 clean.
  //    Service dates for existing shifts derive from startsAt in the location
  //    zone, which by construction (shiftInstants) equals Shift.date.
  if (ctx.maxConsecutiveDays != null) {
    const scheduledDates = new Set<ISODate>([shift.date]);
    for (const s of [...(ctx.priorShifts ?? []), ...otherShifts]) {
      if (s.id !== shift.shiftId) scheduledDates.add(localISODate(s.startsAt, ctx.timezone));
    }
    let run = 1;
    let prevDay = addDaysISO(shift.date, -1);
    while (scheduledDates.has(prevDay)) {
      run += 1;
      prevDay = addDaysISO(prevDay, -1);
    }
    if (run > ctx.maxConsecutiveDays) {
      conflicts.push({
        kind: "consecutive_days",
        message: `${ctx.employeeName} is scheduled ${run} days in a row (limit ${ctx.maxConsecutiveDays}).`,
      });
    }
  }

  return conflicts;
}
