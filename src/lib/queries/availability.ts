// src/lib/queries/availability.ts — manager overview: who can work when, this week.
import { prisma } from "@/lib/db";
import { weekDatesOf } from "@/lib/time";

export type OverviewDay = {
  dayOfWeek: number;
  date: string; // ISODate within the displayed week
  isAvailable: boolean;
  startTime: string | null; // "09:00" or null = all day
  endTime: string | null;
  timeOff: boolean; // approved time off covers this date
};

export type OverviewEmployee = {
  profileId: string;
  name: string;
  primaryPositionId: string | null;
  primaryPositionName: string | null;
  days: OverviewDay[];
};

export type LocationAvailability = {
  weekStart: string;
  employees: OverviewEmployee[];
};

export async function getLocationAvailability(
  locationId: string,
  weekStart: string
): Promise<LocationAvailability> {
  const dates = weekDatesOf(weekStart);
  const weekEnd = dates[6];

  const profiles = await prisma.employeeProfile.findMany({
    where: { locationId, status: "active" },
    include: {
      user: true,
      primaryPosition: true,
      availability: true,
      timeOffRequests: {
        where: {
          status: "approved",
          startDate: { lte: new Date(`${weekEnd}T00:00:00.000Z`) },
          endDate: { gte: new Date(`${weekStart}T00:00:00.000Z`) },
        },
      },
    },
    orderBy: [{ primaryPosition: { sortOrder: "asc" } }, { user: { name: "asc" } }],
  });

  const employees = profiles.map((p) => {
    const byDay = new Map(p.availability.map((r) => [r.dayOfWeek, r]));
    const days = dates.map((date, dayOfWeek) => {
      const rule = byDay.get(dayOfWeek);
      const timeOff = p.timeOffRequests.some(
        (req) =>
          req.startDate.toISOString().slice(0, 10) <= date &&
          req.endDate.toISOString().slice(0, 10) >= date
      );
      return {
        dayOfWeek,
        date,
        isAvailable: rule ? rule.isAvailable : true,
        startTime: rule?.startTime ?? null,
        endTime: rule?.endTime ?? null,
        timeOff,
      };
    });
    return {
      profileId: p.id,
      name: p.user.name,
      primaryPositionId: p.primaryPositionId,
      primaryPositionName: p.primaryPosition?.name ?? null,
      days,
    };
  });

  return { weekStart, employees };
}
