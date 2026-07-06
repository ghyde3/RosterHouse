import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireManagerForApi } from "@/lib/manager-guard";
import { getOrCreateSchedule, toScheduleShift } from "@/lib/schedule-data";
import { updateShiftSchema } from "@/lib/shift-schemas";
import {
  localTimeOfDay,
  parseTime12h,
  shiftInstants,
  toISODate,
  weekStartOfISO,
} from "@/lib/time";

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
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
