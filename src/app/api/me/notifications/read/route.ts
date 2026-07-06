import { z } from "zod";
import { auth } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/api";
import { markNotificationsRead } from "@/lib/queries/employee";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    raw = {}; // empty body = mark all
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonErr("invalid_request", parsed.error.issues[0].message, 400);

  const updated = await markNotificationsRead(session.user.id, parsed.data.ids);
  return jsonOk({ updated });
}
