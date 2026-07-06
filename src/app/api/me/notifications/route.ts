import { z } from "zod";
import { auth } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/api";
import { getMyNotifications } from "@/lib/queries/employee";

const querySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return jsonErr("invalid_request", parsed.error.issues[0].message, 400);

  return jsonOk(await getMyNotifications(session.user.id, parsed.data));
}
