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
  vacationBalanceHours: number | null; // NULL = tracking off
  sickBalanceHours: number | null; // NULL = tracking off
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
    vacationBalanceHours:
      profile.vacationBalanceHours === null ? null : Number(profile.vacationBalanceHours),
    sickBalanceHours: profile.sickBalanceHours === null ? null : Number(profile.sickBalanceHours),
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
    vacationBalanceHours: number | null;
    sickBalanceHours: number | null;
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
          vacationBalanceHours: ctx.vacationBalanceHours,
          sickBalanceHours: ctx.sickBalanceHours,
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
  /**
   * Other employees with published, assigned shifts at the same location on
   * the same service date (whether or not they overlap in time), sorted by
   * start time. Names and positions only — no contact details (privacy).
   */
  shiftMates: { shiftId: string; name: string; positionName: string; timeRange: string }[];
  /** True when the viewer already has a pending drop request for this shift. */
  hasPendingDrop: boolean;
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

  // One same-day query feeds both lists: `coworkers` keeps its original
  // overlap-only semantics (the /api/shifts/[shiftId] contract), while
  // `shiftMates` is everyone else working that service date.
  const sameDay = await prisma.shift.findMany({
    where: {
      locationId: shift.locationId,
      date: shift.date,
      status: "published",
      id: { not: shift.id },
      employeeProfileId: { not: null },
      NOT: { employeeProfileId: viewer.profileId },
    },
    include: { employeeProfile: { include: { user: true } }, position: true },
    orderBy: { startsAt: "asc" },
  });

  const seen = new Set<string>();
  const coworkers: { name: string; positionName: string }[] = [];
  for (const s of sameDay) {
    const p = s.employeeProfile;
    if (!p || seen.has(p.id)) continue;
    if (!(s.startsAt < shift.endsAt && s.endsAt > shift.startsAt)) continue;
    seen.add(p.id);
    coworkers.push({ name: p.user.name, positionName: s.position.name });
  }

  const shiftMates = sameDay
    .filter((s) => s.employeeProfile !== null)
    .map((s) => ({
      shiftId: s.id,
      name: s.employeeProfile!.user.name,
      positionName: s.position.name,
      timeRange: formatShiftRange(s.startsAt, s.endsAt, viewer.timezone),
    }));

  const pendingDrop =
    shift.employeeProfileId === viewer.profileId
      ? await prisma.dropRequest.findFirst({
          where: { shiftId: shift.id, requestingEmployeeProfileId: viewer.profileId, status: "pending" },
          select: { id: true },
        })
      : null;

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
    shiftMates,
    hasPendingDrop: pendingDrop !== null,
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

export type NotificationDto = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string; // ISO instant
  readAt: string | null;
};

export async function getMyNotifications(
  userId: string,
  opts?: { cursor?: string; limit?: number }
): Promise<{ notifications: NotificationDto[]; nextCursor: string | null; unreadCount: number }> {
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
  const unreadCount = await prisma.notification.count({ where: { userId, readAt: null } });
  return {
    notifications: page.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt ? n.readAt.toISOString() : null,
    })),
    nextCursor,
    unreadCount,
  };
}

/** Marks the given notifications (or all unread when ids omitted) as read. Only touches the caller's rows. */
export async function markNotificationsRead(userId: string, ids?: string[]): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  return res.count;
}
