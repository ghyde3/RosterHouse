import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireManagerForApi } from "@/lib/manager-guard";
import { assertNameAvailable } from "@/lib/position-data";
import { updatePositionSchema } from "@/lib/position-schemas";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ positionId: string }> },
) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    const { positionId } = await params;

    const existing = await prisma.position.findFirst({
      where: { id: positionId, locationId: guard.location.id },
    });
    if (!existing) return jsonErr("not_found", "That position no longer exists", 404);

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonErr("invalid_input", "Request body must be JSON", 400);
    }
    const parsed = updatePositionSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const input = parsed.data;

    const data: { name?: string; archivedAt?: Date | null } = {};
    if (input.name !== undefined) {
      await assertNameAvailable(guard.location.id, input.name, { excludeId: positionId });
      data.name = input.name;
    }
    if (input.archived !== undefined) {
      data.archivedAt = input.archived ? new Date() : null;
    }

    const position = await prisma.position.update({
      where: { id: positionId },
      data,
      select: { id: true, name: true, sortOrder: true, archivedAt: true },
    });

    const session = await auth();
    await logAudit({
      organizationId: guard.location.organizationId,
      locationId: guard.location.id,
      actorUserId: guard.userId,
      actorName: session?.user?.name ?? "Manager",
      // Archiving happens through this PATCH (archived: true); restores and
      // renames are plain updates.
      action: input.archived === true ? "position.archived" : "position.updated",
      entityType: "Position",
      entityId: position.id,
      detail: {
        name: position.name,
        ...(input.name !== undefined && input.name !== existing.name
          ? { before: { name: existing.name }, after: { name: position.name } }
          : {}),
        ...(input.archived === false ? { restored: true } : {}),
      },
    });

    return jsonOk({ position });
  } catch (err) {
    return handleApiError(err);
  }
}
