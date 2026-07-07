import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
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

    // Audit only the punch fields that actually changed, before → after.
    const before: Record<string, string | null> = {};
    const after: Record<string, string | null> = {};
    if (existing.clockInAt.getTime() !== entry.clockInAt.getTime()) {
      before.clockInAt = existing.clockInAt.toISOString();
      after.clockInAt = entry.clockInAt.toISOString();
    }
    if ((existing.clockOutAt?.getTime() ?? null) !== (entry.clockOutAt?.getTime() ?? null)) {
      before.clockOutAt = existing.clockOutAt ? existing.clockOutAt.toISOString() : null;
      after.clockOutAt = entry.clockOutAt ? entry.clockOutAt.toISOString() : null;
    }
    const session = await auth();
    await logAudit({
      organizationId: guard.location.organizationId,
      locationId: guard.location.id,
      actorUserId: guard.userId,
      actorName: session?.user?.name ?? "Manager",
      action: "timeclock.edited",
      entityType: "TimeClockEntry",
      entityId: entry.id,
      detail: { before, after },
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
