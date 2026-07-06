import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { requireManagerForApi } from "@/lib/manager-guard";
import { getScheduleWeekData } from "@/lib/schedule-data";
import { isoDateSchema } from "@/lib/shift-schemas";
import { dayOfWeekMon0 } from "@/lib/time";

export async function GET(
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
    const weekStart = new URL(req.url).searchParams.get("weekStart");
    const parsed = isoDateSchema.safeParse(weekStart);
    if (!parsed.success) {
      return jsonErr("invalid_input", "weekStart must be a date like 2026-07-06", 400);
    }
    if (dayOfWeekMon0(parsed.data) !== 0) {
      return jsonErr("invalid_input", "weekStart must be a Monday", 400);
    }
    return jsonOk(await getScheduleWeekData(locationId, parsed.data));
  } catch (err) {
    return handleApiError(err);
  }
}
