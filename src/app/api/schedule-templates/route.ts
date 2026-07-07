import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { requireManagerForApi } from "@/lib/manager-guard";
import { createTemplateSchema } from "@/lib/template-schemas";
import { createTemplate, listTemplates, snapshotWeekToRows } from "@/lib/template-data";

export async function GET() {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    return jsonOk({ templates: await listTemplates(guard.location.id) });
  } catch (err) {
    return handleApiError(err);
  }
}

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
    const parsed = createTemplateSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const input = parsed.data;
    const rows =
      input.fromWeek !== undefined
        ? await snapshotWeekToRows(guard.location.id, input.fromWeek)
        : input.rows ?? [];
    const template = await createTemplate(guard.location.id, input.name, rows);
    return jsonOk({ template }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
