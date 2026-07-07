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

export async function PATCH(req: Request, ctx: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) return jsonErr("invalid_input", "Decision must be approve or deny.", 400);

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);
  if (user.role !== "manager") return jsonErr("forbidden", "Only managers can decide shift claims.", 403);

  const claim = await prisma.openShiftClaim.findUnique({
    where: { id: claimId },
    include: {
      shift: { include: { position: true, location: true } },
      employeeProfile: { include: { user: true } },
    },
  });
  if (!claim) return jsonErr("not_found", "This claim no longer exists.", 404);

  const managerLocation = await getManagerLocation(user.id);
  if (claim.shift.locationId !== managerLocation.id) {
    return jsonErr("forbidden", "You don't manage this location.", 403);
  }

  const { decision } = parsed.data;
  if (decision === "approve" && claim.shift.employeeProfileId !== null) {
    return jsonErr("already_filled", "This shift was already filled.", 409);
  }

  const status = decision === "approve" ? "approved" : "denied";
  const now = new Date();
  let competingUserIds: string[] = [];
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.openShiftClaim.updateMany({
      where: { id: claimId, status: "pending" },
      data: { status, decidedByUserId: user.id, decidedAt: now },
    });
    if (updated.count === 0) return "already_decided" as const;
    if (decision === "approve") {
      const competing = await tx.openShiftClaim.findMany({
        where: { shiftId: claim.shiftId, status: "pending", id: { not: claimId } },
        include: { employeeProfile: true },
      });
      competingUserIds = competing.map((c) => c.employeeProfile.userId);
      await tx.openShiftClaim.updateMany({
        where: { shiftId: claim.shiftId, status: "pending", id: { not: claimId } },
        data: { status: "denied", decidedByUserId: user.id, decidedAt: now },
      });
      // Guard the reassignment on the shift still being open — a concurrent
      // approval or manual PATCH could have filled it since we read `claim`
      // above. If it's no longer open, roll back.
      const reassigned = await tx.shift.updateMany({
        where: { id: claim.shiftId, employeeProfileId: null },
        data: { employeeProfileId: claim.employeeProfileId },
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
  if (result === "already_decided") return jsonErr("already_decided", "This claim was already decided.", 409);
  if (result === "shift_changed") {
    return jsonErr(
      "shift_changed",
      "That shift changed before you could approve. Refresh and try again.",
      409,
    );
  }

  await logAudit({
    organizationId: user.organizationId,
    locationId: claim.shift.locationId,
    actorUserId: user.id,
    actorName: user.name,
    action: decision === "approve" ? "claim.approved" : "claim.denied",
    entityType: "OpenShiftClaim",
    entityId: claim.id,
    detail: {
      date: isoDateOf(claim.shift.date),
      employee: claim.employeeProfile.user.name,
      position: claim.shift.position.name,
    },
  });

  const timezone = claim.shift.location.timezone;
  const shiftLabel = `${formatMediumDate(isoDateOf(claim.shift.date))} ${claim.shift.position.name} shift, ${formatShiftRange(
    claim.shift.startsAt,
    claim.shift.endsAt,
    timezone,
  )}`;
  const claimantUserId = claim.employeeProfile.userId;

  if (decision === "approve") {
    const inputs: NotifyInput[] = [
      { userId: claimantUserId, type: "claim_approved", title: "Shift confirmed", body: `The ${shiftLabel} is yours.` },
      ...competingUserIds.map((userId) => ({
        userId,
        type: "claim_denied" as const,
        title: "Shift filled",
        body: `The ${shiftLabel} went to another teammate this time.`,
      })),
    ];
    await notifyUsers(inputs);
  } else {
    await notifyUsers([
      {
        userId: claimantUserId,
        type: "claim_denied",
        title: "Claim denied",
        body: `Your request for the ${shiftLabel} was denied.`,
      },
    ]);
  }

  let warnings: Conflict[] = [];
  if (decision === "approve") {
    const context = await buildConflictContext(claim.employeeProfileId, weekStartOf(claim.shift.startsAt, timezone));
    warnings = detectConflicts(
      {
        shiftId: claim.shiftId,
        employeeProfileId: claim.employeeProfileId,
        date: isoDateOf(claim.shift.date),
        startsAt: claim.shift.startsAt,
        endsAt: claim.shift.endsAt,
      },
      context,
    );
  }

  return jsonOk({ status, warnings });
}
