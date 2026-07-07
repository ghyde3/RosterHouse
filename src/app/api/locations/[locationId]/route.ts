import { handleApiError, jsonErr, jsonOk, parseJson } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireManagerForApi } from "@/lib/manager-guard";
import { updateLocationSchema } from "@/lib/location-schemas";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    const { locationId } = await params;
    if (guard.location.id !== locationId) {
      return jsonErr("forbidden", "You don't have access to this location", 403);
    }
    const parsed = await parseJson(req, updateLocationSchema);
    if (parsed.error) return parsed.error;
    const input = parsed.data;

    const updated = await prisma.location.update({
      where: { id: locationId },
      data: {
        name: input.name,
        timezone: input.timezone,
        overtimeHoursPerWeek: input.overtimeHoursPerWeek,
        minRestHours: input.minRestHours, // undefined = unchanged
        maxConsecutiveDays: input.maxConsecutiveDays, // undefined = unchanged
        address: input.address,
      },
      select: {
        id: true,
        name: true,
        timezone: true,
        overtimeHoursPerWeek: true,
        minRestHours: true,
        maxConsecutiveDays: true,
        address: true,
      },
    });

    const session = await auth();
    await logAudit({
      organizationId: guard.location.organizationId,
      locationId: guard.location.id,
      actorUserId: guard.userId,
      actorName: session?.user?.name ?? "Manager",
      action: "location.settings_updated",
      entityType: "Location",
      entityId: locationId,
      detail: { changed: Object.keys(input).filter((k) => input[k as keyof typeof input] !== undefined) },
    });

    return jsonOk({ location: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
