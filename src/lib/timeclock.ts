// Time-clock domain logic. Pure helpers up top (unit-tested); the
// prisma-backed screen state below (integration-tested via the API).
import { prisma } from "@/lib/db";
import { formatShiftRange, localToUtc } from "@/lib/time";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export const CLOCK_IN_EARLY_MS = 30 * 60 * 1000;

export function pickClockInShift<T extends { id: string; startsAt: Date; endsAt: Date }>(
  shifts: T[],
  now: Date,
): T | null {
  const eligible = shifts
    .filter((s) => s.startsAt.getTime() - CLOCK_IN_EARLY_MS <= now.getTime() && now.getTime() <= s.endsAt.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return eligible[0] ?? null;
}

export function sumHoursToday(
  entries: { clockInAt: Date; clockOutAt: Date | null }[],
  now: Date,
): number {
  const ms = entries.reduce((total, e) => total + ((e.clockOutAt ?? now).getTime() - e.clockInAt.getTime()), 0);
  return Math.round((ms / 3_600_000) * 10) / 10;
}

export type TimeClockState = {
  activeEntry: { id: string; clockInAt: string; positionName: string | null } | null;
  todayShift: { id: string; positionName: string; timeLabel: string } | null;
  locationName: string;
  hoursToday: number;
};

export async function getTimeClockState(employeeProfileId: string): Promise<TimeClockState> {
  const profile = await prisma.employeeProfile.findUniqueOrThrow({
    where: { id: employeeProfileId },
    include: { location: true },
  });
  const tz = profile.location.timezone;
  const now = new Date();
  const todayISO = format(new TZDate(now, tz), "yyyy-MM-dd");
  const localMidnight = localToUtc(todayISO, { hour: 0, minute: 0 }, tz);

  const [active, todayShifts, entriesToday] = await Promise.all([
    prisma.timeClockEntry.findFirst({
      where: { employeeProfileId, clockOutAt: null },
      include: { shift: { include: { position: true } } },
      orderBy: { clockInAt: "desc" },
    }),
    prisma.shift.findMany({
      where: { employeeProfileId, status: "published", date: new Date(todayISO) },
      include: { position: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.timeClockEntry.findMany({
      where: { employeeProfileId, clockInAt: { gte: localMidnight } },
    }),
  ]);

  const nextToday = todayShifts.find((s) => s.endsAt.getTime() > now.getTime()) ?? null;
  return {
    activeEntry: active
      ? { id: active.id, clockInAt: active.clockInAt.toISOString(), positionName: active.shift?.position.name ?? null }
      : null,
    todayShift: nextToday
      ? { id: nextToday.id, positionName: nextToday.position.name, timeLabel: formatShiftRange(nextToday.startsAt, nextToday.endsAt, tz) }
      : null,
    locationName: profile.location.name,
    hoursToday: sumHoursToday(entriesToday, now),
  };
}
