import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { getAuditLogs, logAudit } from "@/lib/audit";
import { createTestOrg, deleteTestOrg, type TestOrg } from "@/lib/test/factories";

describe("logAudit", () => {
  let t: TestOrg;

  beforeAll(async () => {
    t = await createTestOrg();
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("writes a row with the denormalized actor and detail", async () => {
    await logAudit({
      organizationId: t.organizationId,
      locationId: t.locationId,
      actorUserId: t.managerUserId,
      actorName: "Test Manager",
      action: "schedule.published",
      entityType: "Schedule",
      entityId: "sched-1",
      detail: { weekStartDate: "2026-07-06", shiftCount: 12 },
    });

    const row = await prisma.auditLog.findFirstOrThrow({
      where: { organizationId: t.organizationId, action: "schedule.published" },
    });
    expect(row.locationId).toBe(t.locationId);
    expect(row.actorUserId).toBe(t.managerUserId);
    expect(row.actorName).toBe("Test Manager");
    expect(row.entityType).toBe("Schedule");
    expect(row.entityId).toBe("sched-1");
    expect(row.detail).toEqual({ weekStartDate: "2026-07-06", shiftCount: 12 });
  });

  it("defaults the optional fields to null", async () => {
    await logAudit({
      organizationId: t.organizationId,
      actorName: "Test Manager",
      action: "position.reordered",
    });
    const row = await prisma.auditLog.findFirstOrThrow({
      where: { organizationId: t.organizationId, action: "position.reordered" },
    });
    expect(row.locationId).toBeNull();
    expect(row.actorUserId).toBeNull();
    expect(row.entityType).toBeNull();
    expect(row.entityId).toBeNull();
    expect(row.detail).toBeNull();
  });

  it("never throws — a failed write (FK violation) resolves and logs instead", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        logAudit({
          organizationId: "org-that-does-not-exist",
          actorName: "Test Manager",
          action: "shift.created",
        }),
      ).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
    const count = await prisma.auditLog.count({ where: { organizationId: "org-that-does-not-exist" } });
    expect(count).toBe(0);
  });
});

describe("getAuditLogs", () => {
  let t: TestOrg;

  beforeAll(async () => {
    t = await createTestOrg();
    // 5 entries with strictly increasing createdAt so newest-first is deterministic.
    const base = Date.now() - 60_000;
    for (let i = 0; i < 5; i++) {
      await prisma.auditLog.create({
        data: {
          organizationId: t.organizationId,
          locationId: i === 4 ? null : t.locationId, // newest entry has no location
          actorName: "Test Manager",
          action: "shift.created",
          entityId: `shift-${i}`,
          createdAt: new Date(base + i * 1000),
        },
      });
    }
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("pages newest-first with a working cursor", async () => {
    const first = await getAuditLogs(t.organizationId, { limit: 2 });
    expect(first.entries.map((e) => e.entityId)).toEqual(["shift-4", "shift-3"]);
    expect(first.nextCursor).toBe(first.entries[1].id);

    const second = await getAuditLogs(t.organizationId, { cursor: first.nextCursor!, limit: 2 });
    expect(second.entries.map((e) => e.entityId)).toEqual(["shift-2", "shift-1"]);

    const last = await getAuditLogs(t.organizationId, { cursor: second.nextCursor!, limit: 2 });
    expect(last.entries.map((e) => e.entityId)).toEqual(["shift-0"]);
    expect(last.nextCursor).toBeNull();
  });

  it("filters by location", async () => {
    const page = await getAuditLogs(t.organizationId, { locationId: t.locationId, limit: 10 });
    expect(page.entries).toHaveLength(4);
    expect(page.entries.every((e) => e.locationId === t.locationId)).toBe(true);
  });

  it("clamps the limit into 1..100", async () => {
    const page = await getAuditLogs(t.organizationId, { limit: 0 });
    expect(page.entries).toHaveLength(1);
  });
});
