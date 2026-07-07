import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireManagerForApi } from "@/lib/manager-guard";
import { getOrCreateSchedule, toScheduleShift } from "@/lib/schedule-data";
import { createShiftSchema } from "@/lib/shift-schemas";
import { parseTime12h, shiftInstants, weekStartOfISO } from "@/lib/time";

export async function POST(req: Request) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonErr("invalid_input", "Request body must be JSON", 400);
    }
    // Field-specific messages (e.g. "Enter a time like 7:00 AM") are shown
    // as-is, without a "field: " prefix, so the assign dialog can surface
    // them directly under the offending input.
    const parsed = createShiftSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const input = parsed.data;

    if (guard.location.id !== input.locationId) {
      return jsonErr("forbidden", "You don't have access to this location", 403);
    }
    const position = await prisma.position.findFirst({
      where: { id: input.positionId, locationId: input.locationId, archivedAt: null },
    });
    if (!position) {
      return jsonErr("not_found", "That position doesn't exist at this location", 404);
    }
    if (input.employeeProfileId !== null) {
      const profile = await prisma.employeeProfile.findFirst({
        where: { id: input.employeeProfileId, locationId: input.locationId },
      });
      if (!profile) {
        return jsonErr("not_found", "That employee isn't on this location's team", 404);
      }
    }

    const { startsAt, endsAt } = shiftInstants(
      input.date,
      parseTime12h(input.startTime)!, // schema already validated both times
      parseTime12h(input.endTime)!,
      guard.location.timezone,
    );
    const schedule = await getOrCreateSchedule(input.locationId, weekStartOfISO(input.date));
    const created = await prisma.shift.create({
      data: {
        scheduleId: schedule.id,
        locationId: input.locationId,
        positionId: input.positionId,
        employeeProfileId: input.employeeProfileId,
        date: new Date(input.date),
        startsAt,
        endsAt,
        notes: input.notes ?? null,
        // status defaults to draft — on a published week this marks
        // "unpublished changes" until the manager republishes.
      },
      include: { position: true, employeeProfile: { include: { user: true } } },
    });
    // Conflicts are returned for the UI to warn — creation is never blocked.
    return jsonOk({ shift: await toScheduleShift(created, guard.location.timezone) });
  } catch (err) {
    return handleApiError(err);
  }
}
