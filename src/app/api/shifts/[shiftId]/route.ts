import { auth } from "@/lib/auth";
import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireManagerForApi } from "@/lib/manager-guard";
import { getEmployeeContext, getEmployeeShiftDetail } from "@/lib/queries/employee";
import { getOrCreateSchedule, toScheduleShift } from "@/lib/schedule-data";
import { updateShiftSchema } from "@/lib/shift-schemas";
import {
  formatShiftRange,
  localTimeOfDay,
  parseTime12h,
  shiftInstants,
  toISODate,
  weekStartOfISO,
} from "@/lib/time";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ shiftId: string }> }
) {
  const { shiftId } = await ctx.params;
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  const viewer = await getEmployeeContext(session.user.id);
  if (!viewer) {
    return jsonErr("no_profile", "No employee profile is linked to this account.", 403);
  }

  const shift = await getEmployeeShiftDetail(
    { profileId: viewer.profileId, locationId: viewer.locationId, timezone: viewer.timezone },
    shiftId
  );
  if (!shift) return jsonErr("not_found", "Shift not found.", 404);
  return jsonOk(shift);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ shiftId: string }> },
) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    const { shiftId } = await params;
    const existing = await prisma.shift.findFirst({
      where: { id: shiftId, locationId: guard.location.id },
    });
    if (!existing) return jsonErr("not_found", "That shift no longer exists", 404);

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonErr("invalid_input", "Request body must be JSON", 400);
    }
    // Field-specific messages (e.g. "Enter a time like 7:00 AM") are shown
    // as-is, without a "field: " prefix.
    const parsed = updateShiftSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const input = parsed.data;
    const timezone = guard.location.timezone;

    if (input.positionId !== undefined) {
      const position = await prisma.position.findFirst({
        where: { id: input.positionId, locationId: existing.locationId },
      });
      if (!position) {
        return jsonErr("not_found", "That position doesn't exist at this location", 404);
      }
    }
    if (input.employeeProfileId !== undefined && input.employeeProfileId !== null) {
      const profile = await prisma.employeeProfile.findFirst({
        where: { id: input.employeeProfileId, locationId: existing.locationId },
      });
      if (!profile) {
        return jsonErr("not_found", "That employee isn't on this location's team", 404);
      }
    }

    const date = input.date ?? toISODate(existing.date);
    let { startsAt, endsAt } = existing;
    if (input.date !== undefined || input.startTime !== undefined || input.endTime !== undefined) {
      const start = input.startTime
        ? parseTime12h(input.startTime)!
        : localTimeOfDay(existing.startsAt, timezone);
      const end = input.endTime
        ? parseTime12h(input.endTime)!
        : localTimeOfDay(existing.endsAt, timezone);
      ({ startsAt, endsAt } = shiftInstants(date, start, end, timezone));
    }

    // Moving the date across weeks re-parents the shift to that week's schedule.
    const schedule = await getOrCreateSchedule(existing.locationId, weekStartOfISO(date));

    const updated = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        scheduleId: schedule.id,
        positionId: input.positionId ?? existing.positionId,
        employeeProfileId:
          input.employeeProfileId === undefined ? existing.employeeProfileId : input.employeeProfileId,
        date: new Date(date),
        startsAt,
        endsAt,
        notes: input.notes === undefined ? existing.notes : input.notes,
      },
      include: { position: true, employeeProfile: { include: { user: true } } },
    });

    // Audit only the scalar fields that actually changed, before → after.
    const before: Record<string, string | null> = {};
    const after: Record<string, string | null> = {};
    if (toISODate(existing.date) !== toISODate(updated.date)) {
      before.date = toISODate(existing.date);
      after.date = toISODate(updated.date);
    }
    if (
      existing.startsAt.getTime() !== updated.startsAt.getTime() ||
      existing.endsAt.getTime() !== updated.endsAt.getTime()
    ) {
      before.timeRange = formatShiftRange(existing.startsAt, existing.endsAt, timezone);
      after.timeRange = formatShiftRange(updated.startsAt, updated.endsAt, timezone);
    }
    if (existing.employeeProfileId !== updated.employeeProfileId) {
      const previous = existing.employeeProfileId
        ? await prisma.employeeProfile.findUnique({
            where: { id: existing.employeeProfileId },
            select: { user: { select: { name: true } } },
          })
        : null;
      before.assignee = previous?.user.name ?? null;
      after.assignee = updated.employeeProfile?.user.name ?? null;
    }
    const session = await auth();
    await logAudit({
      organizationId: guard.location.organizationId,
      locationId: guard.location.id,
      actorUserId: guard.userId,
      actorName: session?.user?.name ?? "Manager",
      action: "shift.updated",
      entityType: "Shift",
      entityId: updated.id,
      detail: { date: toISODate(updated.date), before, after },
    });

    return jsonOk({ shift: await toScheduleShift(updated, timezone) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ shiftId: string }> },
) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    const { shiftId } = await params;
    const existing = await prisma.shift.findFirst({
      where: { id: shiftId, locationId: guard.location.id },
    });
    if (!existing) return jsonErr("not_found", "That shift no longer exists", 404);
    await prisma.shift.delete({ where: { id: shiftId } });

    const session = await auth();
    await logAudit({
      organizationId: guard.location.organizationId,
      locationId: guard.location.id,
      actorUserId: guard.userId,
      actorName: session?.user?.name ?? "Manager",
      action: "shift.deleted",
      entityType: "Shift",
      entityId: shiftId,
      detail: {
        date: toISODate(existing.date),
        timeRange: formatShiftRange(existing.startsAt, existing.endsAt, guard.location.timezone),
      },
    });

    return jsonOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
