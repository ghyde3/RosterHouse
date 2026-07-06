import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { requireManagerForApi } from "@/lib/manager-guard";
import { getMonthShiftCounts } from "@/lib/schedule-data";
import { isoDateSchema } from "@/lib/shift-schemas";
import { addDaysISO } from "@/lib/time";

/** Per-day shift counts for the month view. */
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
    const url = new URL(req.url);
    const from = isoDateSchema.safeParse(url.searchParams.get("from"));
    const to = isoDateSchema.safeParse(url.searchParams.get("to"));
    if (!from.success || !to.success) {
      return jsonErr("invalid_input", "from and to must be dates like 2026-07-06", 400);
    }
    if (to.data < from.data || addDaysISO(from.data, 62) < to.data) {
      return jsonErr("invalid_input", "Date range must be between 0 and 62 days", 400);
    }
    return jsonOk({ counts: await getMonthShiftCounts(locationId, from.data, to.data) });
  } catch (err) {
    return handleApiError(err);
  }
}
