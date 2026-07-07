import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { TemplateRowInput } from "@/lib/template-schemas";
import { getOrCreateSchedule, getScheduleWeekData } from "@/lib/schedule-data";
import { buildConflictContext } from "@/lib/conflict-context";
import { detectConflicts, type Conflict } from "@/lib/conflicts";
import {
  addDaysISO,
  dayOfWeekMon0,
  parseTime12h,
  shiftInstants,
  weekStartOfISO,
  type ISODate,
} from "@/lib/time";

export type TemplateRow = {
  id: string;
  positionId: string;
  positionName: string;
  employeeProfileId: string | null;
  employeeName: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  notes: string | null;
};

export type TemplateSummary = { id: string; name: string; rowCount: number; updatedAt: string };
export type TemplateDetail = { id: string; name: string; updatedAt: string; rows: TemplateRow[] };

export const TEMPLATE_ROW_INCLUDE = {
  position: true,
  employeeProfile: { include: { user: true } },
} satisfies Prisma.ScheduleTemplateRowInclude;

type RowWithJoins = Prisma.ScheduleTemplateRowGetPayload<{ include: typeof TEMPLATE_ROW_INCLUDE }>;

/** Minutes-since-midnight for sorting 12h wall-clock strings. */
function minutesOf(time: string): number {
  const t = parseTime12h(time);
  return t ? t.hour * 60 + t.minute : 0;
}

export function sortRows<T extends { dayOfWeek: number; startTime: string }>(rows: T[]): T[] {
  return rows
    .slice()
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || minutesOf(a.startTime) - minutesOf(b.startTime));
}

export function toTemplateRow(row: RowWithJoins): TemplateRow {
  return {
    id: row.id,
    positionId: row.positionId,
    positionName: row.position.name,
    employeeProfileId: row.employeeProfileId,
    employeeName: row.employeeProfile?.user.name ?? null,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    notes: row.notes,
  };
}

function rowCreateData(rows: TemplateRowInput[]) {
  return rows.map((r) => ({
    positionId: r.positionId,
    employeeProfileId: r.employeeProfileId,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    notes: r.notes ?? null,
  }));
}

export async function listTemplates(locationId: string): Promise<TemplateSummary[]> {
  const templates = await prisma.scheduleTemplate.findMany({
    where: { locationId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { rows: true } } },
  });
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    rowCount: t._count.rows,
    updatedAt: t.updatedAt.toISOString(),
  }));
}

export async function getTemplateDetail(
  locationId: string,
  templateId: string,
): Promise<TemplateDetail | null> {
  const template = await prisma.scheduleTemplate.findFirst({
    where: { id: templateId, locationId },
    include: { rows: { include: TEMPLATE_ROW_INCLUDE } },
  });
  if (!template) return null;
  return {
    id: template.id,
    name: template.name,
    updatedAt: template.updatedAt.toISOString(),
    rows: sortRows(template.rows.map(toTemplateRow)),
  };
}

export async function createTemplate(
  locationId: string,
  name: string,
  rows: TemplateRowInput[],
): Promise<TemplateDetail> {
  const dup = await prisma.scheduleTemplate.findFirst({ where: { locationId, name } });
  if (dup) throw new ApiError(409, "name_taken", "A template with that name already exists");
  const created = await prisma.scheduleTemplate.create({
    data: { locationId, name, rows: { create: rowCreateData(rows) } },
  });
  return (await getTemplateDetail(locationId, created.id))!;
}

export async function updateTemplate(
  locationId: string,
  templateId: string,
  patch: { name?: string; rows?: TemplateRowInput[] },
): Promise<TemplateDetail | null> {
  const existing = await prisma.scheduleTemplate.findFirst({ where: { id: templateId, locationId } });
  if (!existing) return null;
  if (patch.name !== undefined && patch.name !== existing.name) {
    const dup = await prisma.scheduleTemplate.findFirst({
      where: { locationId, name: patch.name, id: { not: templateId } },
    });
    if (dup) throw new ApiError(409, "name_taken", "A template with that name already exists");
  }
  await prisma.$transaction([
    ...(patch.rows !== undefined
      ? [
          prisma.scheduleTemplateRow.deleteMany({ where: { templateId } }),
          prisma.scheduleTemplateRow.createMany({
            data: rowCreateData(patch.rows).map((r) => ({ ...r, templateId })),
          }),
        ]
      : []),
    prisma.scheduleTemplate.update({
      where: { id: templateId },
      data: { name: patch.name ?? existing.name },
    }),
  ]);
  return getTemplateDetail(locationId, templateId);
}

export async function deleteTemplate(locationId: string, templateId: string): Promise<boolean> {
  const existing = await prisma.scheduleTemplate.findFirst({ where: { id: templateId, locationId } });
  if (!existing) return false;
  await prisma.scheduleTemplate.delete({ where: { id: templateId } });
  return true;
}

export async function snapshotWeekToRows(
  locationId: string,
  fromWeek: ISODate,
): Promise<TemplateRowInput[]> {
  const data = await getScheduleWeekData(locationId, weekStartOfISO(fromWeek));
  return data.shifts.map((s) => {
    const [startTime, endTime] = s.timeRange.split(" – ");
    return {
      positionId: s.positionId,
      employeeProfileId: s.employeeProfileId,
      dayOfWeek: dayOfWeekMon0(s.date),
      startTime,
      endTime,
      notes: s.notes,
    };
  });
}

export type ResolvedRow = {
  rowId: string;
  positionId: string;
  positionName: string;
  dayOfWeek: number;
  date: ISODate;
  startTime: string;
  endTime: string;
  timeRange: string;
  notes: string | null;
  defaultEmployeeProfileId: string | null; // remembered assignee, only if still valid
  defaultEmployeeName: string | null;
  employeeValid: boolean;
  conflicts: Conflict[];
};
export type TemplatePreview = {
  templateId: string;
  templateName: string;
  targetWeek: ISODate;
  rows: ResolvedRow[];
  occupancy: { draftCount: number; publishedCount: number };
};

export async function resolveTemplateForWeek(
  locationId: string,
  templateId: string,
  targetWeekInput: ISODate,
  timezone: string,
): Promise<TemplatePreview | null> {
  const template = await prisma.scheduleTemplate.findFirst({
    where: { id: templateId, locationId },
    include: { rows: { include: TEMPLATE_ROW_INCLUDE } },
  });
  if (!template) return null;
  const targetWeek = weekStartOfISO(targetWeekInput);
  const schedule = await getOrCreateSchedule(locationId, targetWeek);

  const rememberedIds = [
    ...new Set(template.rows.map((r) => r.employeeProfileId).filter((id): id is string => id !== null)),
  ];
  const [draftCount, publishedCount, validProfiles] = await Promise.all([
    prisma.shift.count({ where: { scheduleId: schedule.id, status: "draft" } }),
    prisma.shift.count({ where: { scheduleId: schedule.id, status: "published" } }),
    prisma.employeeProfile.findMany({ where: { locationId, id: { in: rememberedIds } }, select: { id: true } }),
  ]);
  const validSet = new Set(validProfiles.map((p) => p.id));

  // One conflict context per still-valid employee, reused across their rows.
  const contexts = new Map(
    await Promise.all(
      [...validSet].map(async (id) => [id, await buildConflictContext(id, targetWeek)] as const),
    ),
  );

  const rows = sortRows(template.rows.map(toTemplateRow)).map((r): ResolvedRow => {
    const date = addDaysISO(targetWeek, r.dayOfWeek);
    const employeeValid = r.employeeProfileId !== null && validSet.has(r.employeeProfileId);
    let conflicts: Conflict[] = [];
    if (employeeValid) {
      const { startsAt, endsAt } = shiftInstants(date, parseTime12h(r.startTime)!, parseTime12h(r.endTime)!, timezone);
      conflicts = detectConflicts(
        { employeeProfileId: r.employeeProfileId, date, startsAt, endsAt },
        contexts.get(r.employeeProfileId!)!,
      );
    }
    return {
      rowId: r.id,
      positionId: r.positionId,
      positionName: r.positionName,
      dayOfWeek: r.dayOfWeek,
      date,
      startTime: r.startTime,
      endTime: r.endTime,
      timeRange: `${r.startTime} – ${r.endTime}`,
      notes: r.notes,
      defaultEmployeeProfileId: employeeValid ? r.employeeProfileId : null,
      defaultEmployeeName: employeeValid ? r.employeeName : null,
      employeeValid,
      conflicts,
    };
  });

  return { templateId: template.id, templateName: template.name, targetWeek, rows, occupancy: { draftCount, publishedCount } };
}

export type ApplyResult = { created: number; openCount: number; week: ISODate };

export async function applyTemplate(
  locationId: string,
  templateId: string,
  input: { targetWeek: ISODate; mode: "replace" | "add"; assignments: Record<string, string | null> },
  timezone: string,
): Promise<ApplyResult | null> {
  const template = await prisma.scheduleTemplate.findFirst({
    where: { id: templateId, locationId },
    include: { rows: true },
  });
  if (!template) return null;
  const targetWeek = weekStartOfISO(input.targetWeek);
  const schedule = await getOrCreateSchedule(locationId, targetWeek);

  // Requested assignee per row: explicit override, else the row's remembered default.
  const requestedByRow = new Map(
    template.rows.map((r) => [
      r.id,
      r.id in input.assignments ? input.assignments[r.id] : r.employeeProfileId,
    ]),
  );
  const requestedIds = [...new Set([...requestedByRow.values()].filter((v): v is string => v !== null))];
  const members = await prisma.employeeProfile.findMany({
    where: { locationId, id: { in: requestedIds } },
    select: { id: true },
  });
  const memberSet = new Set(members.map((m) => m.id));

  const shiftData = template.rows.map((r) => {
    const requested = requestedByRow.get(r.id) ?? null;
    const employeeProfileId = requested && memberSet.has(requested) ? requested : null;
    const date = addDaysISO(targetWeek, r.dayOfWeek);
    const { startsAt, endsAt } = shiftInstants(date, parseTime12h(r.startTime)!, parseTime12h(r.endTime)!, timezone);
    return {
      scheduleId: schedule.id,
      locationId,
      positionId: r.positionId,
      employeeProfileId,
      date: new Date(date),
      startsAt,
      endsAt,
      notes: r.notes,
      status: "draft" as const,
    };
  });

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  if (input.mode === "replace") {
    ops.push(prisma.shift.deleteMany({ where: { scheduleId: schedule.id, status: "draft" } }));
  }
  ops.push(prisma.shift.createMany({ data: shiftData }));
  await prisma.$transaction(ops);

  return {
    created: shiftData.length,
    openCount: shiftData.filter((s) => s.employeeProfileId === null).length,
    week: targetWeek,
  };
}
