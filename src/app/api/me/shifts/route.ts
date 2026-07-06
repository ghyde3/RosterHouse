import { z } from "zod";
import { auth } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/api";
import { getEmployeeContext, getMyShifts } from "@/lib/queries/employee";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates.");

const querySchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((q) => q.from <= q.to, {
    message: "The from date must be on or before the to date.",
  });

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: url.searchParams.get("from") ?? "",
    to: url.searchParams.get("to") ?? "",
  });
  if (!parsed.success) {
    return jsonErr("invalid_request", parsed.error.issues[0].message, 400);
  }

  const ctx = await getEmployeeContext(session.user.id);
  if (!ctx) {
    return jsonErr("no_profile", "No employee profile is linked to this account.", 403);
  }

  const data = await getMyShifts(ctx.profileId, parsed.data.from, parsed.data.to, ctx.timezone);
  return jsonOk(data);
}
