import { prisma } from "@/lib/db";
import { getScheduleWeekData } from "@/lib/schedule-data";
import {
  addDaysISO,
  shiftDurationHours,
  weekStartOf,
  type ISODate,
} from "@/lib/time";

export type DashboardData = {
  weekStart: ISODate;
  openShiftsThisWeek: number;
  pendingTimeOff: number;
  pendingSwaps: number;
  pendingClaims: number;
  pendingRequests: number;
  projectedLaborCost: string;
  conflictCountThisWeek: number;
  clockedInNow: { name: string; positionName: string | null }[];
};

export async function getDashboardData(
  locationId: string,
  timezone: string,
): Promise<DashboardData> {
  const weekStart = weekStartOf(new Date(), timezone);
  const weekEnd = addDaysISO(weekStart, 6);

  const [shifts, pendingTimeOff, pendingSwaps, pendingClaims, clockEntries, weekData] =
    await Promise.all([
      prisma.shift.findMany({
        where: { locationId, date: { gte: new Date(weekStart), lte: new Date(weekEnd) } },
        include: { employeeProfile: true },
      }),
      prisma.timeOffRequest.count({
        where: { status: "pending", employeeProfile: { locationId } },
      }),
      prisma.swapRequest.count({ where: { status: "pending", shift: { locationId } } }),
      prisma.openShiftClaim.count({ where: { status: "pending", shift: { locationId } } }),
      prisma.timeClockEntry.findMany({
        where: { locationId, clockOutAt: null },
        include: { employeeProfile: { include: { user: true, primaryPosition: true } } },
        orderBy: { clockInAt: "asc" },
      }),
      getScheduleWeekData(locationId, weekStart), // reuses conflict annotation
    ]);

  const assigned = shifts.filter((s) => s.employeeProfileId !== null);

  // "$4,120"-style. Any assigned shift without a rate makes the projection
  // dishonest, so render an em dash instead of a wrong number.
  let projectedLaborCost = "—";
  if (assigned.length === 0) {
    projectedLaborCost = "$0";
  } else if (assigned.every((s) => s.employeeProfile?.hourlyRate != null)) {
    const total = assigned.reduce(
      (sum, s) =>
        sum + shiftDurationHours(s.startsAt, s.endsAt) * Number(s.employeeProfile!.hourlyRate),
      0,
    );
    projectedLaborCost = `$${Math.round(total).toLocaleString("en-US")}`;
  }

  return {
    weekStart,
    openShiftsThisWeek: shifts.filter((s) => s.employeeProfileId === null).length,
    pendingTimeOff,
    pendingSwaps,
    pendingClaims,
    pendingRequests: pendingTimeOff + pendingSwaps + pendingClaims,
    projectedLaborCost,
    conflictCountThisWeek: weekData.conflictCount,
    clockedInNow: clockEntries.map((e) => ({
      name: e.employeeProfile.user.name,
      positionName: e.employeeProfile.primaryPosition?.name ?? null,
    })),
  };
}
