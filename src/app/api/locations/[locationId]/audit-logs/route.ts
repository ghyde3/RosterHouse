import { z } from "zod";
import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { requireManagerForApi } from "@/lib/manager-guard";
import { getAuditLogs } from "@/lib/audit";

const querySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(
  request: Request,
  ctx: { params: Promise<{ locationId: string }> },
) {
  try {
    const { locationId } = await ctx.params;
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);

    if (guard.location.id !== locationId) {
      return jsonErr("forbidden", "You don't have access to this location.", 403);
    }

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) return jsonErr("invalid_request", parsed.error.issues[0].message, 400);

    return jsonOk(
      await getAuditLogs(guard.location.organizationId, {
        locationId,
        cursor: parsed.data.cursor,
        limit: parsed.data.limit ?? 30,
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
