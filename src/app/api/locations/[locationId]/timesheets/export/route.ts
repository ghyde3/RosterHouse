import { handleApiError, jsonErr } from "@/lib/api";
import { requireManagerForApi } from "@/lib/manager-guard";
import { isoDateSchema } from "@/lib/shift-schemas";
import { getTimesheetWeekData, timesheetsToCsv } from "@/lib/timesheet-data";
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

    const data = await getTimesheetWeekData(locationId, parsed.data);
    const csv = timesheetsToCsv(data);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="timesheets-${parsed.data}.csv"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
