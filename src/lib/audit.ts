// src/lib/audit.ts — append-only org activity trail.
//
// logAudit is BEST-EFFORT by contract: it never throws and never blocks the
// caller's response semantics. Call it AFTER the mutation succeeds (outside
// any transaction) so a failed audit write can never roll back real work and
// a rolled-back transaction never leaves a phantom audit row.
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/** Every action the app writes today. Keep dotted verb form: "entity.verb". */
export const AUDIT_ACTIONS = [
  "schedule.published",
  "shift.created",
  "shift.updated",
  "shift.deleted",
  "timeclock.edited",
  "team.member_updated",
  "team.invited",
  "position.created",
  "position.updated",
  "position.reordered",
  "position.archived",
  "timeoff.approved",
  "timeoff.denied",
  "swap.approved",
  "swap.denied",
  "claim.approved",
  "claim.denied",
  "drop.approved",
  "drop.denied",
  "template.applied",
  "location.settings_updated",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntry = {
  organizationId: string;
  locationId?: string;
  actorUserId?: string;
  /** Denormalized at write time so entries outlive the actor's account. */
  actorName: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  /** SMALL structured context (ids, before/after scalars, week dates) — never whole rows. */
  detail?: Prisma.InputJsonValue;
};

/**
 * Append one audit row. Best-effort: failures are logged to the console and
 * swallowed — an audit hiccup must never turn a successful mutation into an
 * error response.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        locationId: entry.locationId ?? null,
        actorUserId: entry.actorUserId ?? null,
        actorName: entry.actorName,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        detail: entry.detail ?? undefined,
      },
    });
  } catch (err) {
    console.error(`audit: failed to record "${entry.action}"`, err);
  }
}

export type AuditLogDto = {
  id: string;
  locationId: string | null;
  actorUserId: string | null;
  actorName: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  detail: Prisma.JsonValue | null;
  createdAt: string; // ISO instant
};

/**
 * Newest-first page of audit entries for an organization (optionally one
 * location). Cursor pagination mirrors getMyNotifications: an id cursor over
 * a (createdAt desc, id desc) ordering.
 */
export async function getAuditLogs(
  organizationId: string,
  opts?: { locationId?: string; cursor?: string; limit?: number },
): Promise<{ entries: AuditLogDto[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 100);
  const rows = await prisma.auditLog.findMany({
    where: {
      organizationId,
      ...(opts?.locationId ? { locationId: opts.locationId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
  return {
    entries: page.map((e) => ({
      id: e.id,
      locationId: e.locationId,
      actorUserId: e.actorUserId,
      actorName: e.actorName,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      detail: (e.detail ?? null) as Prisma.JsonValue | null,
      createdAt: e.createdAt.toISOString(),
    })),
    nextCursor,
  };
}
