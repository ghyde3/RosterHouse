import { prisma } from "@/lib/db";
import type { ConflictContext } from "@/lib/conflicts";
import { addDaysISO, toISODate, type ISODate } from "@/lib/time";

/**
 * Assemble everything detectConflicts needs for one employee and one week
 * (weekStart = Monday, ISODate). Pending time off is ignored — only
 * approved requests block scheduling.
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

  const [shifts, timeOff] = await Promise.all([
    prisma.shift.findMany({
      where: {
        employeeProfileId,
        date: { gte: new Date(weekStart), lte: new Date(weekEnd) },
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
  ]);

  return {
    timezone: profile.location.timezone,
    employeeName: profile.user.name,
    employeeShifts: shifts.map((s) => ({
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
    overtimeHoursPerWeek: profile.location.overtimeHoursPerWeek,
  };
}
