import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createTestEmployee,
  createTestOrg,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { GET } from "./route";

const authMock = auth as unknown as Mock;

function get(locationId: string, qs = "") {
  return GET(new Request(`http://test.local/api/locations/${locationId}/audit-logs${qs}`), {
    params: Promise.resolve({ locationId }),
  });
}

function signInManager(t: TestOrg) {
  authMock.mockResolvedValue({
    user: { id: t.managerUserId, name: "Test Manager", role: "manager", organizationId: t.organizationId },
  });
}

describe("GET /api/locations/[locationId]/audit-logs", () => {
  let mine: TestOrg;
  let other: TestOrg;

  beforeAll(async () => {
    mine = await createTestOrg();
    other = await createTestOrg();
    const base = Date.now() - 60_000;
    for (let i = 0; i < 3; i++) {
      await prisma.auditLog.create({
        data: {
          organizationId: mine.organizationId,
          locationId: mine.locationId,
          actorName: "Test Manager",
          action: "shift.created",
          entityId: `shift-${i}`,
          createdAt: new Date(base + i * 1000),
        },
      });
    }
  });

  afterAll(async () => {
    await deleteTestOrg(mine.organizationId);
    await deleteTestOrg(other.organizationId);
  });

  it("returns entries newest-first with a cursor for the next page", async () => {
    signInManager(mine);
    const res = await get(mine.locationId, "?limit=2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.entries.map((e: { entityId: string }) => e.entityId)).toEqual([
      "shift-2",
      "shift-1",
    ]);
    expect(body.data.nextCursor).toBe(body.data.entries[1].id);

    const res2 = await get(mine.locationId, `?limit=2&cursor=${body.data.nextCursor}`);
    const body2 = await res2.json();
    expect(body2.data.entries.map((e: { entityId: string }) => e.entityId)).toEqual(["shift-0"]);
    expect(body2.data.nextCursor).toBeNull();
  });

  it("rejects an employee caller (403)", async () => {
    const emp = await createTestEmployee(mine, "Sam Test");
    authMock.mockResolvedValueOnce({
      user: { id: emp.userId, name: "Sam Test", role: "employee", organizationId: mine.organizationId },
    });
    const res = await get(mine.locationId);
    expect(res.status).toBe(403);
  });

  it("rejects a signed-out caller (401)", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await get(mine.locationId);
    expect(res.status).toBe(401);
  });

  it("rejects a manager from another organization's location (403)", async () => {
    signInManager(other);
    const res = await get(mine.locationId);
    expect(res.status).toBe(403);
    expect((await res.json()).error.message).toBe("You don't have access to this location.");
  });

  it("rejects an out-of-range limit (400)", async () => {
    signInManager(mine);
    const res = await get(mine.locationId, "?limit=101");
    expect(res.status).toBe(400);
  });
});
