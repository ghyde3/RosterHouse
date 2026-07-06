// Read-model helpers for the request loops (time off, swaps, claims).
// Server components call these directly; API routes wrap them.
import { prisma } from "@/lib/db";
import { formatDateRange } from "@/lib/time";
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
