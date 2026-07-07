import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireManagerForApi } from "@/lib/manager-guard";
import { reorderPositionsSchema } from "@/lib/position-schemas";

export async function PATCH(req: Request) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonErr("invalid_input", "Request body must be JSON", 400);
    }
    const parsed = reorderPositionsSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const { orderedIds } = parsed.data;

    // Every id must belong to this location; anything else is a tenancy break.
    const owned = await prisma.position.findMany({
      where: { id: { in: orderedIds }, locationId: guard.location.id },
      select: { id: true },
    });
    if (owned.length !== orderedIds.length) {
      return jsonErr("forbidden", "Those positions aren't all at this location", 403);
    }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.position.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );

    return jsonOk({ positions: orderedIds.map((id, index) => ({ id, sortOrder: index })) });
  } catch (err) {
    return handleApiError(err);
  }
}
