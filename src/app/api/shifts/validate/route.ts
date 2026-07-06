import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { buildConflictContext } from "@/lib/conflict-context";
import { detectConflicts } from "@/lib/conflicts";
import { requireManagerForApi } from "@/lib/manager-guard";
import { validateShiftSchema } from "@/lib/shift-schemas";
import { parseTime12h, shiftInstants, weekStartOfISO } from "@/lib/time";

/** Dry run for the assign dialog's live warnings. Never writes. */
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
    const parsed = validateShiftSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const input = parsed.data;
    if (guard.location.id !== input.locationId) {
      return jsonErr("forbidden", "You don't have access to this location", 403);
    }
    if (input.employeeProfileId === null) return jsonOk({ conflicts: [] });

    const { startsAt, endsAt } = shiftInstants(
      input.date,
      parseTime12h(input.startTime)!,
      parseTime12h(input.endTime)!,
      guard.location.timezone,
    );
    const ctx = await buildConflictContext(input.employeeProfileId, weekStartOfISO(input.date));
    const conflicts = detectConflicts(
      {
        shiftId: input.shiftId,
        employeeProfileId: input.employeeProfileId,
        date: input.date,
        startsAt,
        endsAt,
      },
      ctx,
    );
    return jsonOk({ conflicts });
  } catch (err) {
    return handleApiError(err);
  }
}
