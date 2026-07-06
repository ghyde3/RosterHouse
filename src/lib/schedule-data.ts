import { Prisma } from "@/generated/prisma/client";
import { buildConflictContext } from "@/lib/conflict-context";
import { detectConflicts, type Conflict } from "@/lib/conflicts";
import { prisma } from "@/lib/db";
import {
  formatShiftRange,
  formatTimeHM,
  toISODate,
  weekStartOfISO,
  type ISODate,
} from "@/lib/time";

export type ShiftWithJoins = Prisma.ShiftGetPayload<{
  include: { position: true; employeeProfile: { include: { user: true } } };
}>;

export type ScheduleShift = {
  id: string;
  positionId: string;
  positionName: string;
  employeeProfileId: string | null;
  employeeName: string | null;
  date: ISODate;
  startsAt: string; // UTC ISO instant (JSON-safe)
  endsAt: string;
  timeRange: string; // "7:00 AM – 3:00 PM"
  status: "draft" | "published";
  notes: string | null;
  uiStatus: "draft" | "confirmed" | "open" | "conflict";
  conflicts: Conflict[];
};

export type ScheduleWeekData = {
  schedule: {
    id: string;
    status: "draft" | "published";
    publishedAt: string | null;
    hasUnpublishedChanges: boolean;
  };
  weekStart: ISODate;
  positions: { id: string; name: string }[];
  shifts: ScheduleShift[];
  conflictCount: number;
  assignedEmployeeCount: number;
};

export type EmployeeOption = {
  employeeProfileId: string;
  name: string;
  positionIds: string[];
  availabilityByDay: string[]; // 7 entries Mon..Sun
};

export function getOrCreateSchedule(locationId: string, weekStart: ISODate) {
  return prisma.schedule.upsert({
    where: { locationId_weekStartDate: { locationId, weekStartDate: new Date(weekStart) } },
    create: { locationId, weekStartDate: new Date(weekStart) },
    update: {},
  });
}

function shapeShift(shift: ShiftWithJoins, conflicts: Conflict[], timezone: string): ScheduleShift {
  const uiStatus: ScheduleShift["uiStatus"] =
    shift.employeeProfileId === null
      ? "open"
      : conflicts.length > 0
        ? "conflict"
        : shift.status === "published"
          ? "confirmed"
          : "draft";
  return {
    id: shift.id,
    positionId: shift.positionId,
    positionName: shift.position.name,
    employeeProfileId: shift.employeeProfileId,
    employeeName: shift.employeeProfile?.user.name ?? null,
    date: toISODate(shift.date),
    startsAt: shift.startsAt.toISOString(),
    endsAt: shift.endsAt.toISOString(),
    timeRange: formatShiftRange(shift.startsAt, shift.endsAt, timezone),
    status: shift.status,
    notes: shift.notes,
    uiStatus,
    conflicts,
  };
}

/** Annotate a single shift (used by the POST/PATCH responses). */
export async function toScheduleShift(shift: ShiftWithJoins, timezone: string): Promise<ScheduleShift> {
  let conflicts: Conflict[] = [];
  if (shift.employeeProfileId !== null) {
    const date = toISODate(shift.date);
    const ctx = await buildConflictContext(shift.employeeProfileId, weekStartOfISO(date));
    conflicts = detectConflicts(
      {
        shiftId: shift.id,
        employeeProfileId: shift.employeeProfileId,
        date,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
      },
      ctx,
    );
  }
  return shapeShift(shift, conflicts, timezone);
}

export async function getScheduleWeekData(
  locationId: string,
  weekStart: ISODate,
): Promise<ScheduleWeekData> {
  const location = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
  const schedule = await getOrCreateSchedule(locationId, weekStart);
  const [positions, shifts] = await Promise.all([
    prisma.position.findMany({ where: { locationId }, orderBy: { sortOrder: "asc" } }),
    prisma.shift.findMany({
      where: { scheduleId: schedule.id },
      include: { position: true, employeeProfile: { include: { user: true } } },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  // One conflict context per distinct employee, reused across their shifts.
  const employeeIds = [
    ...new Set(
      shifts.map((s) => s.employeeProfileId).filter((id): id is string => id !== null),
    ),
  ];
  const contexts = new Map(
    await Promise.all(
      employeeIds.map(async (id) => [id, await buildConflictContext(id, weekStart)] as const),
    ),
  );

  const annotated = shifts.map((s) => {
    const conflicts = s.employeeProfileId
      ? detectConflicts(
          {
            shiftId: s.id,
            employeeProfileId: s.employeeProfileId,
            date: toISODate(s.date),
            startsAt: s.startsAt,
            endsAt: s.endsAt,
          },
          contexts.get(s.employeeProfileId)!,
        )
      : [];
    return shapeShift(s, conflicts, location.timezone);
  });

  // Republish detection: a published schedule has unpublished changes when a
  // shift is still draft (added after publish) or edited after publishedAt.
  const hasUnpublishedChanges =
    schedule.status === "published" &&
    shifts.some(
      (s) =>
        s.status === "draft" ||
        (schedule.publishedAt !== null && s.updatedAt > schedule.publishedAt),
    );

  return {
    schedule: {
      id: schedule.id,
      status: schedule.status,
      publishedAt: schedule.publishedAt?.toISOString() ?? null,
      hasUnpublishedChanges,
    },
    weekStart,
    positions: positions.map((p) => ({ id: p.id, name: p.name })),
    shifts: annotated,
    conflictCount: annotated.filter((s) => s.uiStatus === "conflict").length,
    assignedEmployeeCount: employeeIds.length,
  };
}

export async function getMonthShiftCounts(
  locationId: string,
  from: ISODate,
  to: ISODate,
): Promise<Record<ISODate, number>> {
  const shifts = await prisma.shift.findMany({
    where: { locationId, date: { gte: new Date(from), lte: new Date(to) } },
    select: { date: true },
  });
  const counts: Record<ISODate, number> = {};
  for (const s of shifts) {
    const key = toISODate(s.date);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export async function getAssignableEmployees(locationId: string): Promise<EmployeeOption[]> {
  const profiles = await prisma.employeeProfile.findMany({
    where: { locationId, status: "active" },
    include: { user: true, positions: true, availability: true },
    orderBy: { user: { name: "asc" } },
  });
  return profiles.map((p) => ({
    employeeProfileId: p.id,
    name: p.user.name,
    positionIds: p.positions.map((ep) => ep.positionId),
    availabilityByDay: Array.from({ length: 7 }, (_, dow) => {
      const rule = p.availability.find((r) => r.dayOfWeek === dow);
      if (!rule) return "All day";
      if (!rule.isAvailable) return "Off";
      if (rule.startTime && rule.endTime) {
        return `${formatTimeHM(rule.startTime)} – ${formatTimeHM(rule.endTime)}`;
      }
      return "All day";
    }),
  }));
}
