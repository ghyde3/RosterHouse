import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getManagerLocation } from "@/lib/authz";
import { listPendingApprovals } from "@/lib/requests";

export async function GET(req: Request, ctx: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await ctx.params;
  const raw = new URL(req.url).searchParams.get("status") ?? "pending";
  if (!z.literal("pending").safeParse(raw).success) {
    return jsonErr("invalid_input", "Only status=pending is supported.", 400);
  }

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);
  if (user.role !== "manager") return jsonErr("forbidden", "Only managers can view approvals.", 403);

  const managerLocation = await getManagerLocation(user.id);
  if (managerLocation.id !== locationId) return jsonErr("forbidden", "You don't manage this location.", 403);

  return jsonOk({ approvals: await listPendingApprovals(locationId) });
}
