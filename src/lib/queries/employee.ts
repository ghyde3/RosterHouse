// src/lib/queries/employee.ts — read helpers shared by employee pages and /api/me/* routes.
import { prisma } from "@/lib/db";
import { formatShiftRange, shiftDurationHours } from "@/lib/time";
import { formatDayFull } from "@/lib/time-format";

export type EmployeeContext = {
  userId: string;
  name: string;
  firstName: string;
  email: string | null;
  phone: string | null;
  profileId: string;
  locationId: string;
  locationName: string;
  locationAddress: string | null;
  timezone: string;
  primaryPositionName: string | null;
  status: "invited" | "active" | "inactive";
  notifyPush: boolean;
  notifySms: boolean;
  notifyEmail: boolean;
};

export async function getEmployeeContext(userId: string): Promise<EmployeeContext | null> {
  const profile = await prisma.employeeProfile.findFirst({
    where: { userId },
    include: { user: true, location: true, primaryPosition: true },
  });
  if (!profile) return null;
  return {
    userId,
    name: profile.user.name,
    firstName: profile.user.name.split(" ")[0],
    email: profile.user.email,
    phone: profile.user.phone,
    profileId: profile.id,
    locationId: profile.locationId,
    locationName: profile.location.name,
    locationAddress: profile.location.address,
    timezone: profile.location.timezone,
    primaryPositionName: profile.primaryPosition?.name ?? null,
    status: profile.status,
    notifyPush: profile.notifyPush,
    notifySms: profile.notifySms,
    notifyEmail: profile.notifyEmail,
  };
}

export type MePayload = {
  user: {
    id: string;
    name: string;
    firstName: string;
    email: string | null;
    phone: string | null;
    role: "manager" | "employee";
  };
  profile: {
    id: string;
    locationId: string;
    locationName: string;
    locationAddress: string | null;
    timezone: string;
    primaryPositionName: string | null;
    status: "invited" | "active" | "inactive";
    notifyPush: boolean;
    notifySms: boolean;
    notifyEmail: boolean;
  } | null;
};

export async function getMe(userId: string): Promise<MePayload | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const ctx = await getEmployeeContext(userId);
  return {
    user: {
      id: user.id,
      name: user.name,
      firstName: user.name.split(" ")[0],
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    profile: ctx
      ? {
          id: ctx.profileId,
          locationId: ctx.locationId,
          locationName: ctx.locationName,
          locationAddress: ctx.locationAddress,
          timezone: ctx.timezone,
          primaryPositionName: ctx.primaryPositionName,
          status: ctx.status,
          notifyPush: ctx.notifyPush,
          notifySms: ctx.notifySms,
          notifyEmail: ctx.notifyEmail,
        }
      : null,
  };
}

export type EmployeeShiftDto = {
  id: string;
  date: string; // ISODate service date
  startsAt: string; // ISO UTC instant
  endsAt: string;
  positionName: string;
  timeRange: string; // "7:00 AM – 3:00 PM" in the location timezone
  durationHours: number;
};

export async function getMyShifts(
  profileId: string,
  from: string,
  to: string,
  timezone: string
): Promise<{ shifts: EmployeeShiftDto[]; summary: { shiftCount: number; totalHours: number } }> {
  const rows = await prisma.shift.findMany({
    where: {
      employeeProfileId: profileId,
      status: "published",
      date: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T00:00:00.000Z`),
      },
    },
    include: { position: true },
    orderBy: { startsAt: "asc" },
  });
  const shifts = rows.map((s) => ({
    id: s.id,
    date: s.date.toISOString().slice(0, 10),
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    positionName: s.position.name,
    timeRange: formatShiftRange(s.startsAt, s.endsAt, timezone),
    durationHours: shiftDurationHours(s.startsAt, s.endsAt),
  }));
  const totalHours = shifts.reduce((sum, s) => sum + s.durationHours, 0);
  return { shifts, summary: { shiftCount: shifts.length, totalHours } };
}

export type ShiftDetailDto = {
  id: string;
  date: string;
  dayLabel: string; // "Mon Jul 6"
  startsAt: string;
  endsAt: string;
  positionName: string;
  isOpen: boolean;
  timeRange: string;
  durationHours: number;
  notes: string | null;
  location: { name: string; address: string | null; timezone: string };
  coworkers: { name: string; positionName: string }[];
};

/**
 * A shift an employee may see: their own published shift, or a published
 * open shift at their location. Coworkers = other employees whose published
 * shifts at the same location + service date overlap this one in time.
 */
export async function getEmployeeShiftDetail(
  viewer: { profileId: string; locationId: string; timezone: string },
  shiftId: string
): Promise<ShiftDetailDto | null> {
  const shift = await prisma.shift.findFirst({
    where: {
      id: shiftId,
      status: "published",
      OR: [
        { employeeProfileId: viewer.profileId },
        { employeeProfileId: null, locationId: viewer.locationId },
      ],
    },
    include: { position: true, location: true },
  });
  if (!shift) return null;

  const overlapping = await prisma.shift.findMany({
    where: {
      locationId: shift.locationId,
      date: shift.date,
      status: "published",
      id: { not: shift.id },
      employeeProfileId: { not: null },
      NOT: { employeeProfileId: viewer.profileId },
      startsAt: { lt: shift.endsAt },
      endsAt: { gt: shift.startsAt },
    },
    include: { employeeProfile: { include: { user: true } }, position: true },
    orderBy: { startsAt: "asc" },
  });

  const seen = new Set<string>();
  const coworkers: { name: string; positionName: string }[] = [];
  for (const s of overlapping) {
    const p = s.employeeProfile;
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    coworkers.push({ name: p.user.name, positionName: s.position.name });
  }

  const dateISO = shift.date.toISOString().slice(0, 10);
  return {
    id: shift.id,
    date: dateISO,
    dayLabel: formatDayFull(dateISO),
    startsAt: shift.startsAt.toISOString(),
    endsAt: shift.endsAt.toISOString(),
    positionName: shift.position.name,
    isOpen: shift.employeeProfileId === null,
    timeRange: formatShiftRange(shift.startsAt, shift.endsAt, viewer.timezone),
    durationHours: shiftDurationHours(shift.startsAt, shift.endsAt),
    notes: shift.notes,
    location: {
      name: shift.location.name,
      address: shift.location.address,
      timezone: shift.location.timezone,
    },
    coworkers,
  };
}

export type AvailabilityRuleDto = {
  dayOfWeek: number; // 0=Mon..6=Sun
  isAvailable: boolean;
  startTime: string | null; // "09:00" location-local 24-hour; null = all day
  endTime: string | null;
};

/** Always exactly 7 rules, dayOfWeek 0..6; missing days default to available all day. */
export async function getMyAvailability(profileId: string): Promise<AvailabilityRuleDto[]> {
  const rows = await prisma.availabilityRule.findMany({
    where: { employeeProfileId: profileId },
  });
  const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]));
  const rules: AvailabilityRuleDto[] = [];
  for (let d = 0; d < 7; d++) {
    const rule = byDay.get(d);
    rules.push({
      dayOfWeek: d,
      isAvailable: rule ? rule.isAvailable : true,
      startTime: rule?.startTime ?? null,
      endTime: rule?.endTime ?? null,
    });
  }
  return rules;
}
