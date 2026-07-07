import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { requireManagerForApi } from "@/lib/manager-guard";
import { previewTemplateSchema } from "@/lib/template-schemas";
import { resolveTemplateForWeek } from "@/lib/template-data";

export async function POST(req: Request, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    const { templateId } = await params;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonErr("invalid_input", "Request body must be JSON", 400);
    }
    const parsed = previewTemplateSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const preview = await resolveTemplateForWeek(
      guard.location.id,
      templateId,
      parsed.data.targetWeek,
      guard.location.timezone,
    );
    if (!preview) return jsonErr("not_found", "That template no longer exists", 404);
    return jsonOk({ preview });
  } catch (err) {
    return handleApiError(err);
  }
}
