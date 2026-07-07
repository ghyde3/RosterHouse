// src/lib/queries/availability-exceptions.ts — one-off per-date availability
// overrides, shared by /api/me/availability* routes and the employee page.
// An exception WINS over the weekly AvailabilityRule for its date.
import { prisma } from "@/lib/db";

export type AvailabilityExceptionDto = {
  date: string; // ISODate, location-local (like Shift.date)
  isAvailable: boolean;
  startTime: string | null; // "09:00" location-local 24-hour; null = all day
  endTime: string | null;
  note: string | null;
};

/** Exceptions on or after `fromISO` (the employee's local today), soonest first. */
export async function getMyAvailabilityExceptions(
  profileId: string,
  fromISO: string
): Promise<AvailabilityExceptionDto[]> {
  const rows = await prisma.availabilityException.findMany({
    where: {
      employeeProfileId: profileId,
      date: { gte: new Date(`${fromISO}T00:00:00.000Z`) },
    },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    isAvailable: r.isAvailable,
    startTime: r.startTime,
    endTime: r.endTime,
    note: r.note,
  }));
}
