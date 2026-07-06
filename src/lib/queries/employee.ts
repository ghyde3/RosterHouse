// src/lib/queries/employee.ts — read helpers shared by employee pages and /api/me/* routes.
import { prisma } from "@/lib/db";
import { formatShiftRange, shiftDurationHours } from "@/lib/time";

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
