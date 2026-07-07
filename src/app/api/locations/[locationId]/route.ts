import { handleApiError, jsonErr, jsonOk, parseJson } from "@/lib/api";
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
        address: input.address,
      },
      select: {
        id: true,
        name: true,
        timezone: true,
        overtimeHoursPerWeek: true,
        address: true,
      },
    });
    return jsonOk({ location: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
