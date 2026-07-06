import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { TemplateRowInput } from "@/lib/template-schemas";
import { parseTime12h } from "@/lib/time";

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
