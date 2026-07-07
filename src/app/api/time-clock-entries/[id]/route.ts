import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireManagerForApi } from "@/lib/manager-guard";
import { updateEntrySchema } from "@/lib/timesheet-schemas";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    const { id } = await params;

    const existing = await prisma.timeClockEntry.findFirst({
      where: { id, locationId: guard.location.id },
    });
    if (!existing) return jsonErr("not_found", "That time entry no longer exists", 404);

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonErr("invalid_input", "Request body must be JSON", 400);
    }
    const parsed = updateEntrySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const input = parsed.data;

    const clockInAt = input.clockInAt ? new Date(input.clockInAt) : existing.clockInAt;
    const clockOutAt =
      input.clockOutAt === undefined
        ? existing.clockOutAt
        : input.clockOutAt === null
          ? null
          : new Date(input.clockOutAt);
    if (clockOutAt !== null && clockOutAt.getTime() <= clockInAt.getTime()) {
      return jsonErr("invalid_input", "Clock-out must be after clock-in", 400);
    }

    const entry = await prisma.timeClockEntry.update({
      where: { id },
      data: {
        clockInAt,
        clockOutAt,
        editedByUserId: guard.userId,
        editedAt: new Date(),
      },
    });

    return jsonOk({
      entry: {
        id: entry.id,
        clockInAt: entry.clockInAt.toISOString(),
        clockOutAt: entry.clockOutAt ? entry.clockOutAt.toISOString() : null,
        editedByUserId: entry.editedByUserId,
        editedAt: entry.editedAt ? entry.editedAt.toISOString() : null,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    const { id } = await params;

    const existing = await prisma.timeClockEntry.findFirst({
      where: { id, locationId: guard.location.id },
    });
    if (!existing) return jsonErr("not_found", "That time entry no longer exists", 404);

    await prisma.timeClockEntry.delete({ where: { id } });
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
