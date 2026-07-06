import { z } from "zod";
import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { requireManagerForApi } from "@/lib/manager-guard";
import { weekStartOf } from "@/lib/time";
import { getLocationAvailability } from "@/lib/queries/availability";

const weekSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD week start.");

export async function GET(
  request: Request,
  ctx: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await ctx.params;
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);

    if (guard.location.id !== locationId) {
      return jsonErr("forbidden", "You don't have access to this location.", 403);
    }

    const url = new URL(request.url);
    const weekParam = url.searchParams.get("week") ?? weekStartOf(new Date(), guard.location.timezone);
    const parsed = weekSchema.safeParse(weekParam);
    if (!parsed.success) return jsonErr("invalid_request", parsed.error.issues[0].message, 400);

    return jsonOk(await getLocationAvailability(locationId, parsed.data));
  } catch (err) {
    return handleApiError(err);
  }
}
