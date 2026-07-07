import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { sessionUser } from "@/lib/api-session";
import { getManagerLocation } from "@/lib/authz";
import { notifyUsers } from "@/lib/notify";
import type { NotifyInput } from "@/lib/notify";
import { buildConflictContext } from "@/lib/conflict-context";
import { detectConflicts, type Conflict } from "@/lib/conflicts";
import { formatMediumDate, formatShiftRange, weekStartOf } from "@/lib/time";
import { isoDateOf } from "@/lib/requests";

const decisionSchema = z.object({ decision: z.enum(["approve", "deny"]) });

/** Signals the guarded shift reassignment missed — used to roll back the transaction. */
class ShiftChangedError extends Error {}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) return jsonErr("invalid_input", "Decision must be approve or deny.", 400);

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);
  if (user.role !== "manager") return jsonErr("forbidden", "Only managers can decide swap requests.", 403);

  const request = await prisma.swapRequest.findUnique({
    where: { id },
    include: {
      shift: { include: { position: true, location: true } },
      requester: { include: { user: true } },
      coverer: { include: { user: true } },
    },
  });
  if (!request) return jsonErr("not_found", "This swap request no longer exists.", 404);

  const managerLocation = await getManagerLocation(user.id);
  if (request.shift.locationId !== managerLocation.id) {
    return jsonErr("forbidden", "You don't manage this location.", 403);
  }

  const { decision } = parsed.data;
  if (decision === "approve" && request.shift.employeeProfileId !== request.requestingEmployeeProfileId) {
    return jsonErr("shift_changed", "This shift changed since the request was made.", 409);
  }

  const status = decision === "approve" ? "approved" : "denied";
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.swapRequest.updateMany({
      where: { id, status: "pending" },
      data: { status, decidedByUserId: user.id, decidedAt: new Date() },
    });
    if (updated.count === 0) return "already_decided" as const;
    if (decision === "approve") {
      // Guard the reassignment on the shift still being assigned to the
      // requester — a concurrent approval or manual PATCH could have moved
      // it since we read `request` above. If it doesn't match, roll back.
      const reassigned = await tx.shift.updateMany({
        where: { id: request.shiftId, employeeProfileId: request.requestingEmployeeProfileId },
        data: { employeeProfileId: request.coveringEmployeeProfileId },
      });
      if (reassigned.count === 0) {
        throw new ShiftChangedError();
      }
    }
    return "decided" as const;
  }).catch((err) => {
    if (err instanceof ShiftChangedError) return "shift_changed" as const;
    throw err;
  });
  if (result === "already_decided") return jsonErr("already_decided", "This request was already decided.", 409);
  if (result === "shift_changed") {
    return jsonErr(
      "shift_changed",
      "That shift changed before you could approve. Refresh and try again.",
      409,
    );
  }

  await logAudit({
    organizationId: user.organizationId,
    locationId: request.shift.locationId,
    actorUserId: user.id,
    actorName: user.name,
    action: decision === "approve" ? "swap.approved" : "swap.denied",
    entityType: "SwapRequest",
    entityId: request.id,
    detail: {
      date: isoDateOf(request.shift.date),
      requester: request.requester.user.name,
      coverer: request.coverer?.user.name ?? null,
    },
  });

  const timezone = request.shift.location.timezone;
  const shiftLabel = `${formatMediumDate(isoDateOf(request.shift.date))} ${request.shift.position.name} shift, ${formatShiftRange(
    request.shift.startsAt,
    request.shift.endsAt,
    timezone,
  )}`;
  const requesterUserId = request.requester.userId;
  const requesterName = request.requester.user.name;

  if (decision === "approve" && request.coverer) {
    await notifyUsers([
      {
        userId: requesterUserId,
        type: "swap_approved",
        title: "Swap approved",
        body: `${request.coverer.user.name} will cover your ${shiftLabel}.`,
      },
      {
        userId: request.coverer.userId,
        type: "swap_approved",
        title: "You picked up a shift",
        body: `You're covering ${requesterName}'s ${shiftLabel}.`,
      },
    ]);
  } else if (decision === "approve") {
    await notifyUsers([
      {
        userId: requesterUserId,
        type: "swap_approved",
        title: "Swap approved",
        body: `Your ${shiftLabel} is now posted as an open shift.`,
      },
    ]);
  } else {
    const inputs: NotifyInput[] = [
      {
        userId: requesterUserId,
        type: "swap_denied",
        title: "Swap request denied",
        body: `Your swap request for the ${shiftLabel} was denied. You're still scheduled.`,
      },
    ];
    if (request.coverer) {
      inputs.push({
        userId: request.coverer.userId,
        type: "swap_denied",
        title: "Swap not needed",
        body: `${requesterName}'s request for you to cover the ${shiftLabel} was denied. Nothing changes for you.`,
      });
    }
    await notifyUsers(inputs);
  }

  // Re-run conflict detection on the resulting assignment. Warnings inform,
  // never block — the manager already approved.
  let warnings: Conflict[] = [];
  if (decision === "approve" && request.coveringEmployeeProfileId) {
    const context = await buildConflictContext(
      request.coveringEmployeeProfileId,
      weekStartOf(request.shift.startsAt, timezone),
    );
    warnings = detectConflicts(
      {
        shiftId: request.shiftId, // exclude the just-reassigned shift itself
        employeeProfileId: request.coveringEmployeeProfileId,
        date: isoDateOf(request.shift.date),
        startsAt: request.shift.startsAt,
        endsAt: request.shift.endsAt,
      },
      context,
    );
  }

  return jsonOk({ status, warnings });
}
