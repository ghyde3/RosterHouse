import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { requireManagerForApi } from "@/lib/manager-guard";
import { updateTemplateSchema } from "@/lib/template-schemas";
import { deleteTemplate, getTemplateDetail, updateTemplate } from "@/lib/template-data";

export async function GET(_req: Request, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    const { templateId } = await params;
    const template = await getTemplateDetail(guard.location.id, templateId);
    if (!template) return jsonErr("not_found", "That template no longer exists", 404);
    return jsonOk({ template });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ templateId: string }> }) {
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
    const parsed = updateTemplateSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const template = await updateTemplate(guard.location.id, templateId, parsed.data);
    if (!template) return jsonErr("not_found", "That template no longer exists", 404);
    return jsonOk({ template });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    const { templateId } = await params;
    const ok = await deleteTemplate(guard.location.id, templateId);
    if (!ok) return jsonErr("not_found", "That template no longer exists", 404);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
