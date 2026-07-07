import { prisma } from "@/lib/db";
import { countPendingRequests } from "@/lib/requests";
import { getScheduleWeekData } from "@/lib/schedule-data";
import {
  addDaysISO,
  localToUtc,
  shiftDurationHours,
  weekStartOf,
  type ISODate,
} from "@/lib/time";
import { entryHours } from "@/lib/timesheet-data";

export type DashboardData = {
  weekStart: ISODate;
  openShiftsThisWeek: number;
  pendingTimeOff: number;
  pendingSwaps: number;
  pendingClaims: number;
  pendingRequests: number;
  projectedLaborCost: string;
  actualLaborCost: string;
  conflictCountThisWeek: number;
  clockedInNow: { name: string; positionName: string | null }[];
};

export async function getDashboardData(
  locationId: string,
  timezone: string,
): Promise<DashboardData> {
  const weekStart = weekStartOf(new Date(), timezone);
  const weekEnd = addDaysISO(weekStart, 6);

  const [shifts, pendingTimeOff, pendingSwaps, pendingClaims, pendingRequests, clockEntries, weekData, weekClockEntries] =
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
      countPendingRequests(locationId),
      prisma.timeClockEntry.findMany({
        where: { locationId, clockOutAt: null },
        include: { employeeProfile: { include: { user: true, primaryPosition: true } } },
        orderBy: { clockInAt: "asc" },
      }),
      getScheduleWeekData(locationId, weekStart), // reuses conflict annotation
      prisma.timeClockEntry.findMany({
        where: {
          locationId,
          clockInAt: {
            gte: localToUtc(weekStart, { hour: 0, minute: 0 }, timezone),
            lt: localToUtc(addDaysISO(weekStart, 7), { hour: 0, minute: 0 }, timezone),
          },
        },
        include: { employeeProfile: true },
      }),
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

  // Actual week-to-date cost: only completed entries; any completed entry
  // whose employee has no rate makes the figure dishonest → em dash.
  const completed = weekClockEntries.filter((e) => e.clockOutAt !== null);
  let actualLaborCost = "—";
  if (completed.length === 0) {
    actualLaborCost = "$0";
  } else if (completed.every((e) => e.employeeProfile.hourlyRate != null)) {
    const total = completed.reduce(
      (sum, e) => sum + entryHours(e.clockInAt, e.clockOutAt) * Number(e.employeeProfile.hourlyRate),
      0,
    );
    actualLaborCost = `$${Math.round(total).toLocaleString("en-US")}`;
  }

  return {
    weekStart,
    openShiftsThisWeek: shifts.filter((s) => s.employeeProfileId === null).length,
    pendingTimeOff,
    pendingSwaps,
    pendingClaims,
    pendingRequests,
    projectedLaborCost,
    actualLaborCost,
    conflictCountThisWeek: weekData.conflictCount,
    clockedInNow: clockEntries.map((e) => ({
      name: e.employeeProfile.user.name,
      positionName: e.employeeProfile.primaryPosition?.name ?? null,
    })),
  };
}
