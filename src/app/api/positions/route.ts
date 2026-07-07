import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireManagerForApi } from "@/lib/manager-guard";
import { assertNameAvailable, nextSortOrder } from "@/lib/position-data";
import { createPositionSchema } from "@/lib/position-schemas";

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
    const parsed = createPositionSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const name = parsed.data.name;

    await assertNameAvailable(guard.location.id, name); // throws ApiError(409) on collision
    const position = await prisma.position.create({
      data: {
        locationId: guard.location.id,
        name,
        sortOrder: await nextSortOrder(guard.location.id),
      },
      select: { id: true, name: true, sortOrder: true, archivedAt: true },
    });

    const session = await auth();
    await logAudit({
      organizationId: guard.location.organizationId,
      locationId: guard.location.id,
      actorUserId: guard.userId,
      actorName: session?.user?.name ?? "Manager",
      action: "position.created",
      entityType: "Position",
      entityId: position.id,
      detail: { name: position.name },
    });

    return jsonOk({ position }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
