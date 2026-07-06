import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getManagerLocation } from "@/lib/authz";
import { notifyUsers } from "@/lib/notify";
import { formatDateRange } from "@/lib/time";
import { isoDateOf } from "@/lib/requests";

const decisionSchema = z.object({
  decision: z.enum(["approve", "deny"]),
  note: z.string().trim().max(500).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) return jsonErr("invalid_input", "Decision must be approve or deny.", 400);

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);
  if (user.role !== "manager") return jsonErr("forbidden", "Only managers can decide time-off requests.", 403);

  const request = await prisma.timeOffRequest.findUnique({
    where: { id: requestId },
    include: { employeeProfile: { include: { user: true } } },
  });
  if (!request) return jsonErr("not_found", "This request no longer exists.", 404);

  const managerLocation = await getManagerLocation(user.id);
  if (request.employeeProfile.locationId !== managerLocation.id) {
    return jsonErr("forbidden", "You don't manage this location.", 403);
  }

  const { decision, note } = parsed.data;
  const status = decision === "approve" ? "approved" : "denied";
  const decided = await prisma.$transaction(async (tx) => {
    const updated = await tx.timeOffRequest.updateMany({
      where: { id: requestId, status: "pending" },
      data: { status, decidedByUserId: user.id, decidedAt: new Date() },
    });
    return updated.count === 1;
  });
  if (!decided) return jsonErr("already_decided", "This request was already decided.", 409);

  const rangeLabel = formatDateRange(isoDateOf(request.startDate), isoDateOf(request.endDate));
  if (decision === "approve") {
    await notifyUsers([
      {
        userId: request.employeeProfile.userId,
        type: "timeoff_approved",
        title: "Time off approved",
        body: `Your time off for ${rangeLabel} is approved.`,
      },
    ]);
  } else {
    const suffix = note ? ` Note from your manager: ${note}` : "";
    await notifyUsers([
      {
        userId: request.employeeProfile.userId,
        type: "timeoff_denied",
        title: "Time off request denied",
        body: `Your time off request for ${rangeLabel} was denied.${suffix}`,
      },
    ]);
  }

  return jsonOk({ status });
}
