import { prisma } from "@/lib/db";
import type { ConflictContext } from "@/lib/conflicts";
import { addDaysISO, toISODate, type ISODate } from "@/lib/time";

/**
 * Assemble everything detectConflicts needs for one employee and one week
 * (weekStart = Monday, ISODate). Pending time off is ignored — only
 * approved requests block scheduling.
 *
 * Shift load window: the week itself plus a lookback of
 * max(2, location.maxConsecutiveDays ?? 0) days before weekStart.
 * - 2 days always: the rest rule (minRestHours capped at 24) can reach back
 *   to a shift ending the day before the week starts, including one dated two
 *   days back that crosses midnight.
 * - maxConsecutiveDays days when set: enough run prefix to know a shift early
 *   in the week is already past the limit (a run that started even earlier
 *   still flags — the in-message day count just stops at the window edge).
 * Lookback shifts land in ctx.priorShifts, NOT ctx.employeeShifts, so the
 * week-scoped rules (double-booking, overtime) are unaffected.
 */
export async function buildConflictContext(
  employeeProfileId: string,
  weekStart: ISODate,
): Promise<ConflictContext> {
  const profile = await prisma.employeeProfile.findUniqueOrThrow({
    where: { id: employeeProfileId },
    include: { user: true, location: true, availability: true },
  });
  const weekEnd = addDaysISO(weekStart, 6);
  const lookbackDays = Math.max(2, profile.location.maxConsecutiveDays ?? 0);
  const loadFrom = addDaysISO(weekStart, -lookbackDays);

  const [shifts, timeOff, exceptions] = await Promise.all([
    prisma.shift.findMany({
      where: {
        employeeProfileId,
        date: { gte: new Date(loadFrom), lte: new Date(weekEnd) },
      },
      include: { position: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.timeOffRequest.findMany({
      where: {
        employeeProfileId,
        status: "approved",
        startDate: { lte: new Date(weekEnd) },
        endDate: { gte: new Date(weekStart) },
      },
    }),
    prisma.availabilityException.findMany({
      where: {
        employeeProfileId,
        date: { gte: new Date(weekStart), lte: new Date(weekEnd) },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const weekShifts = shifts.filter((s) => toISODate(s.date) >= weekStart);
  const priorShifts = shifts.filter((s) => toISODate(s.date) < weekStart);

  return {
    timezone: profile.location.timezone,
    employeeName: profile.user.name,
    employeeShifts: weekShifts.map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      positionName: s.position.name,
    })),
    priorShifts: priorShifts.map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      positionName: s.position.name,
    })),
    availability: profile.availability.map((r) => ({
      dayOfWeek: r.dayOfWeek,
      isAvailable: r.isAvailable,
      startTime: r.startTime,
      endTime: r.endTime,
    })),
    approvedTimeOff: timeOff.map((t) => ({
      startDate: toISODate(t.startDate),
      endDate: toISODate(t.endDate),
    })),
    availabilityExceptions: exceptions.map((e) => ({
      date: toISODate(e.date),
      isAvailable: e.isAvailable,
      startTime: e.startTime,
      endTime: e.endTime,
    })),
    overtimeHoursPerWeek: profile.location.overtimeHoursPerWeek,
    minRestHours: profile.location.minRestHours,
    maxConsecutiveDays: profile.location.maxConsecutiveDays,
  };
}
