import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireManagerForApi } from "@/lib/manager-guard";
import { createEntrySchema } from "@/lib/timesheet-schemas";

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
    const parsed = createEntrySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const input = parsed.data;

    const profile = await prisma.employeeProfile.findFirst({
      where: { id: input.employeeProfileId, locationId: guard.location.id },
    });
    if (!profile) {
      return jsonErr("not_found", "That employee isn't on this location's team", 404);
    }
    if (input.shiftId != null) {
      const shift = await prisma.shift.findFirst({
        where: { id: input.shiftId, locationId: guard.location.id },
      });
      if (!shift) {
        return jsonErr("not_found", "That shift doesn't exist at this location", 404);
      }
    }

    const now = new Date();
    const entry = await prisma.timeClockEntry.create({
      data: {
        employeeProfileId: input.employeeProfileId,
        locationId: guard.location.id,
        shiftId: input.shiftId ?? null,
        clockInAt: new Date(input.clockInAt),
        clockOutAt: input.clockOutAt ? new Date(input.clockOutAt) : null,
        editedByUserId: guard.userId,
        editedAt: now,
      },
    });

    return jsonOk({
      entry: {
        id: entry.id,
        clockInAt: entry.clockInAt.toISOString(),
        clockOutAt: entry.clockOutAt ? entry.clockOutAt.toISOString() : null,
        shiftId: entry.shiftId,
        editedByUserId: entry.editedByUserId,
        editedAt: entry.editedAt ? entry.editedAt.toISOString() : null,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
