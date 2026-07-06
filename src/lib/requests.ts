// Read-model helpers for the request loops (time off, swaps, claims).
// Server components call these directly; API routes wrap them.
import { prisma } from "@/lib/db";
import { formatDateRange, formatMediumDate, formatShiftRange } from "@/lib/time";
import { subDays } from "date-fns";
import type { RequestStatus, TimeOffReason } from "@/generated/prisma/client";

export function isoDateOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const REASON_LABELS: Record<TimeOffReason, string> = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  other: "Other",
};

export type TimeOffItem = {
  id: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
  reason: TimeOffReason;
  reasonLabel: string;
  note: string | null;
  status: RequestStatus;
  createdAt: string;
  decidedAt: string | null;
};

type TimeOffRow = {
  id: string;
  startDate: Date;
  endDate: Date;
  reason: TimeOffReason;
  note: string | null;
  status: RequestStatus;
  createdAt: Date;
  decidedAt: Date | null;
  employeeProfile: { user: { name: string } };
};

function toTimeOffItem(row: TimeOffRow): TimeOffItem {
  const startDate = isoDateOf(row.startDate);
  const endDate = isoDateOf(row.endDate);
  return {
    id: row.id,
    employeeName: row.employeeProfile.user.name,
    startDate,
    endDate,
    rangeLabel: formatDateRange(startDate, endDate),
    reason: row.reason,
    reasonLabel: REASON_LABELS[row.reason],
    note: row.note,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}

const timeOffInclude = { employeeProfile: { include: { user: true } } } as const;

export async function listTimeOff(locationId: string, status: RequestStatus): Promise<TimeOffItem[]> {
  const rows = await prisma.timeOffRequest.findMany({
    where: { status, employeeProfile: { locationId } },
    include: timeOffInclude,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toTimeOffItem);
}

export async function listMyTimeOffRequests(employeeProfileId: string): Promise<TimeOffItem[]> {
  const rows = await prisma.timeOffRequest.findMany({
    where: { employeeProfileId },
    include: timeOffInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toTimeOffItem);
}

export async function listDecidedTimeOff(locationId: string): Promise<TimeOffItem[]> {
  const rows = await prisma.timeOffRequest.findMany({
    where: {
      employeeProfile: { locationId },
      status: { in: ["approved", "denied"] },
      decidedAt: { gte: subDays(new Date(), 30) },
    },
    include: timeOffInclude,
    orderBy: { decidedAt: "desc" },
  });
  return rows.map(toTimeOffItem);
}

export type Coworker = { profileId: string; name: string };

export async function listQualifiedCoworkers(
  locationId: string,
  positionId: string,
  excludeProfileId: string,
): Promise<Coworker[]> {
  const rows = await prisma.employeeProfile.findMany({
    where: {
      locationId,
      status: "active",
      id: { not: excludeProfileId },
      positions: { some: { positionId } },
    },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((r) => ({ profileId: r.id, name: r.user.name }));
}

export type OpenShiftItem = {
  shiftId: string;
  date: string;
  dayLabel: string;
  positionName: string;
  timeLabel: string;
  qualified: boolean;
  myClaimStatus: RequestStatus | null;
};

export async function listOpenShiftsForEmployee(employeeProfileId: string): Promise<OpenShiftItem[]> {
  const profile = await prisma.employeeProfile.findUniqueOrThrow({
    where: { id: employeeProfileId },
    include: { location: true, positions: true },
  });
  const shifts = await prisma.shift.findMany({
    where: {
      locationId: profile.locationId,
      employeeProfileId: null,
      status: "published",
      startsAt: { gt: new Date() },
    },
    include: { position: true, claims: { where: { employeeProfileId } } },
    orderBy: { startsAt: "asc" },
  });
  const qualifiedIds = new Set(profile.positions.map((p) => p.positionId));
  return shifts.map((s) => {
    const date = isoDateOf(s.date);
    return {
      shiftId: s.id,
      date,
      dayLabel: formatMediumDate(date),
      positionName: s.position.name,
      timeLabel: formatShiftRange(s.startsAt, s.endsAt, profile.location.timezone),
      qualified: qualifiedIds.has(s.positionId),
      myClaimStatus: s.claims[0]?.status ?? null,
    };
  });
}

export type MyRequestItem = {
  id: string;
  kind: "swap" | "claim";
  label: string;
  detail: string;
  status: RequestStatus;
  createdAt: string;
};

export async function listMyRequests(employeeProfileId: string): Promise<MyRequestItem[]> {
  const profile = await prisma.employeeProfile.findUniqueOrThrow({
    where: { id: employeeProfileId },
    include: { location: true },
  });
  const tz = profile.location.timezone;
  const [swaps, claims] = await Promise.all([
    prisma.swapRequest.findMany({
      where: { requestingEmployeeProfileId: employeeProfileId },
      include: { shift: { include: { position: true } }, coverer: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.openShiftClaim.findMany({
      where: { employeeProfileId },
      include: { shift: { include: { position: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const items: MyRequestItem[] = [
    ...swaps.map((r) => ({
      id: r.id,
      kind: "swap" as const,
      label: `Swap · ${formatMediumDate(isoDateOf(r.shift.date))} ${r.shift.position.name}`,
      detail: r.coverer ? `Asked ${r.coverer.user.name} to cover` : "Open to anyone qualified",
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    ...claims.map((c) => ({
      id: c.id,
      kind: "claim" as const,
      label: `Claim · ${formatMediumDate(isoDateOf(c.shift.date))} ${c.shift.position.name}`,
      detail: formatShiftRange(c.shift.startsAt, c.shift.endsAt, tz),
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    })),
  ];
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type ApprovalItem = {
  id: string;
  kind: "swap" | "claim";
  employeeName: string;
  detail: string;
  subDetail: string;
  note: string | null;
  createdAt: string;
};

export async function listPendingApprovals(locationId: string): Promise<ApprovalItem[]> {
  const location = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
  const tz = location.timezone;
  const shiftLabel = (shift: { date: Date; startsAt: Date; endsAt: Date; position: { name: string } }) =>
    `${formatMediumDate(isoDateOf(shift.date))} ${shift.position.name} shift, ${formatShiftRange(shift.startsAt, shift.endsAt, tz)}`;

  const [swaps, claims] = await Promise.all([
    prisma.swapRequest.findMany({
      where: { status: "pending", shift: { locationId } },
      include: {
        shift: { include: { position: true } },
        requester: { include: { user: true } },
        coverer: { include: { user: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.openShiftClaim.findMany({
      where: { status: "pending", shift: { locationId } },
      include: { shift: { include: { position: true } }, employeeProfile: { include: { user: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const items: ApprovalItem[] = [
    ...swaps.map((r) => ({
      id: r.id,
      kind: "swap" as const,
      employeeName: r.requester.user.name,
      detail: `Wants to swap their ${shiftLabel(r.shift)}`,
      subDetail: r.coverer ? `${r.coverer.user.name} offered to cover` : "Open to anyone qualified",
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    })),
    ...claims.map((c) => ({
      id: c.id,
      kind: "claim" as const,
      employeeName: c.employeeProfile.user.name,
      detail: `Wants to pick up the open ${shiftLabel(c.shift)}`,
      subDetail: "Awaiting your approval",
      note: null,
      createdAt: c.createdAt.toISOString(),
    })),
  ];
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export type SwappableShift = {
  shiftId: string;
  dayLabel: string;
  positionName: string;
  timeLabel: string;
  hasPendingSwap: boolean;
};

export async function listMyUpcomingShifts(employeeProfileId: string, limit = 5): Promise<SwappableShift[]> {
  const profile = await prisma.employeeProfile.findUniqueOrThrow({
    where: { id: employeeProfileId },
    include: { location: true },
  });
  const shifts = await prisma.shift.findMany({
    where: { employeeProfileId, status: "published", startsAt: { gt: new Date() } },
    include: { position: true, swapRequests: { where: { status: "pending" } } },
    orderBy: { startsAt: "asc" },
    take: limit,
  });
  return shifts.map((s) => ({
    shiftId: s.id,
    dayLabel: formatMediumDate(isoDateOf(s.date)),
    positionName: s.position.name,
    timeLabel: formatShiftRange(s.startsAt, s.endsAt, profile.location.timezone),
    hasPendingSwap: s.swapRequests.length > 0,
  }));
}
