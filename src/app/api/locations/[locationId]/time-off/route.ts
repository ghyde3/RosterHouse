import { z } from "zod";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getManagerLocation } from "@/lib/authz";
import { listTimeOff } from "@/lib/requests";

const statusSchema = z.enum(["pending", "approved", "denied", "cancelled"]);

export async function GET(req: Request, ctx: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await ctx.params;
  const raw = new URL(req.url).searchParams.get("status") ?? "pending";
  const status = statusSchema.safeParse(raw);
  if (!status.success) {
    return jsonErr("invalid_input", "Status must be pending, approved, denied, or cancelled.", 400);
  }

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);
  if (user.role !== "manager") return jsonErr("forbidden", "Only managers can view time-off requests.", 403);

  const managerLocation = await getManagerLocation(user.id);
  if (managerLocation.id !== locationId) return jsonErr("forbidden", "You don't manage this location.", 403);

  return jsonOk({ requests: await listTimeOff(locationId, status.data) });
}
