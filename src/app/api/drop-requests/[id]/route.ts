import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { sessionUser } from "@/lib/api-session";
import { getManagerLocation } from "@/lib/authz";
import { notifyUsers } from "@/lib/notify";
import { formatMediumDate, formatShiftRange } from "@/lib/time";
import { isoDateOf } from "@/lib/requests";

const decisionSchema = z.object({ decision: z.enum(["approve", "deny"]) });

/** Signals the guarded shift unassignment missed — used to roll back the transaction. */
class ShiftChangedError extends Error {}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) return jsonErr("invalid_input", "Decision must be approve or deny.", 400);

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);
  if (user.role !== "manager") return jsonErr("forbidden", "Only managers can decide drop requests.", 403);

  const request = await prisma.dropRequest.findUnique({
    where: { id },
    include: {
      shift: { include: { position: true, location: true } },
      requester: { include: { user: true } },
    },
  });
  if (!request) return jsonErr("not_found", "This drop request no longer exists.", 404);

  const managerLocation = await getManagerLocation(user.id);
  if (request.shift.locationId !== managerLocation.id) {
    return jsonErr("forbidden", "You don't manage this location.", 403);
  }

  const { decision } = parsed.data;
  if (decision === "approve" && request.shift.employeeProfileId !== request.requestingEmployeeProfileId) {
    return jsonErr("drop_stale", "This shift changed since the request was made.", 409);
  }

  const status = decision === "approve" ? "approved" : "denied";
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.dropRequest.updateMany({
      where: { id, status: "pending" },
      data: { status, decidedByUserId: user.id, decidedAt: new Date() },
    });
    if (updated.count === 0) return "already_decided" as const;
    if (decision === "approve") {
      // Guard the unassignment on the shift still being assigned to the
      // requester — a concurrent approval or manual PATCH could have moved
      // it since we read `request` above. If it doesn't match, roll back.
      const unassigned = await tx.shift.updateMany({
        where: { id: request.shiftId, employeeProfileId: request.requestingEmployeeProfileId },
        data: { employeeProfileId: null },
      });
      if (unassigned.count === 0) {
        throw new ShiftChangedError();
      }
    }
    return "decided" as const;
  }).catch((err) => {
    if (err instanceof ShiftChangedError) return "drop_stale" as const;
    throw err;
  });
  if (result === "already_decided") return jsonErr("already_decided", "This request was already decided.", 409);
  if (result === "drop_stale") {
    return jsonErr(
      "drop_stale",
      "That shift changed before you could approve. Refresh and try again.",
      409,
    );
  }

  await logAudit({
    organizationId: user.organizationId,
    locationId: request.shift.locationId,
    actorUserId: user.id,
    actorName: user.name,
    action: decision === "approve" ? "drop.approved" : "drop.denied",
    entityType: "DropRequest",
    entityId: request.id,
    detail: {
      date: isoDateOf(request.shift.date),
      employee: request.requester.user.name,
      position: request.shift.position.name,
    },
  });

  const timezone = request.shift.location.timezone;
  const shiftLabel = `${formatMediumDate(isoDateOf(request.shift.date))} ${request.shift.position.name} shift, ${formatShiftRange(
    request.shift.startsAt,
    request.shift.endsAt,
    timezone,
  )}`;

  if (decision === "approve") {
    await notifyUsers([
      {
        userId: request.requester.userId,
        type: "drop_approved",
        title: "Drop approved",
        body: `You're off the ${shiftLabel}. It's now posted as an open shift.`,
      },
    ]);
  } else {
    await notifyUsers([
      {
        userId: request.requester.userId,
        type: "drop_denied",
        title: "Drop request denied",
        body: `Your request to drop the ${shiftLabel} was denied. You're still scheduled.`,
      },
    ]);
  }

  return jsonOk({ status });
}
