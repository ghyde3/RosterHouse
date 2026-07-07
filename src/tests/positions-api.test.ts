import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mockSession = vi.hoisted(() => ({
  current: null as null | {
    user: { id: string; name: string; role: "manager" | "employee"; organizationId: string };
  },
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => mockSession.current) }));

import { prisma } from "@/lib/db";
import { POST as createPosition } from "@/app/api/positions/route";
import { PATCH as patchPosition } from "@/app/api/positions/[positionId]/route";
import { PATCH as reorderPositions } from "@/app/api/positions/reorder/route";
import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";

let f: Fixture;

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://test/api/positions", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  f = await createFixture();
  mockSession.current = {
    user: { id: f.managerUserId, name: f.managerName, role: "manager", organizationId: f.orgId },
  };
});
afterAll(async () => {
  await destroyFixture(f);
});

describe("POST /api/positions", () => {
  it("401s when signed out", async () => {
    const saved = mockSession.current;
    mockSession.current = null;
    const res = await createPosition(jsonRequest("POST", { name: "Bartender" }));
    expect(res.status).toBe(401);
    mockSession.current = saved;
  });

  it("creates a position with the next sortOrder", async () => {
    const res = await createPosition(jsonRequest("POST", { name: "Bartender" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.position.name).toBe("Bartender");
    expect(body.data.position.sortOrder).toBe(2); // after Server(0), Dishwasher(1)
    expect(body.data.position.archivedAt).toBeNull();
  });

  it("409s on a case-insensitive duplicate name", async () => {
    const res = await createPosition(jsonRequest("POST", { name: "  server  " }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("name_taken");
  });

  it("400s on an empty name", async () => {
    const res = await createPosition(jsonRequest("POST", { name: "   " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_input");
  });
});

describe("PATCH /api/positions/[positionId]", () => {
  it("renames a position", async () => {
    const created = await prisma.position.create({
      data: { locationId: f.locationId, name: "Runner", sortOrder: 50 },
    });
    const res = await patchPosition(
      jsonRequest("PATCH", { name: "Food runner" }),
      { params: Promise.resolve({ positionId: created.id }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.position.name).toBe("Food runner");
  });

  it("409s renaming onto another active position's name (case-insensitive)", async () => {
    const created = await prisma.position.create({
      data: { locationId: f.locationId, name: "Expeditor", sortOrder: 51 },
    });
    const res = await patchPosition(
      jsonRequest("PATCH", { name: "SERVER" }),
      { params: Promise.resolve({ positionId: created.id }) },
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("name_taken");
  });

  it("allows renaming a position to its own name unchanged", async () => {
    const created = await prisma.position.create({
      data: { locationId: f.locationId, name: "Sommelier", sortOrder: 52 },
    });
    const res = await patchPosition(
      jsonRequest("PATCH", { name: "sommelier" }),
      { params: Promise.resolve({ positionId: created.id }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.position.name).toBe("sommelier");
  });

  it("archives a position (sets archivedAt) and unarchives it (clears it)", async () => {
    const created = await prisma.position.create({
      data: { locationId: f.locationId, name: "Busser", sortOrder: 53 },
    });
    const archiveRes = await patchPosition(
      jsonRequest("PATCH", { archived: true }),
      { params: Promise.resolve({ positionId: created.id }) },
    );
    expect((await archiveRes.json()).data.position.archivedAt).not.toBeNull();

    const unarchiveRes = await patchPosition(
      jsonRequest("PATCH", { archived: false }),
      { params: Promise.resolve({ positionId: created.id }) },
    );
    expect((await unarchiveRes.json()).data.position.archivedAt).toBeNull();
  });

  it("404s for a position at another location (tenancy)", async () => {
    const other = await createFixture();
    try {
      const res = await patchPosition(
        jsonRequest("PATCH", { name: "Nope" }),
        { params: Promise.resolve({ positionId: other.positionIds.server }) },
      );
      expect(res.status).toBe(404);
    } finally {
      await destroyFixture(other);
    }
  });
});

describe("PATCH /api/positions/reorder", () => {
  function reorderRequest(body: unknown): Request {
    return new Request("http://test/api/positions/reorder", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("assigns sortOrder by index across the passed ids", async () => {
    const a = await prisma.position.create({ data: { locationId: f.locationId, name: "Reorder A", sortOrder: 60 } });
    const b = await prisma.position.create({ data: { locationId: f.locationId, name: "Reorder B", sortOrder: 61 } });
    const c = await prisma.position.create({ data: { locationId: f.locationId, name: "Reorder C", sortOrder: 62 } });

    const res = await reorderPositions(reorderRequest({ orderedIds: [c.id, a.id, b.id] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const rows = await prisma.position.findMany({
      where: { id: { in: [a.id, b.id, c.id] } },
    });
    const byId = new Map(rows.map((r) => [r.id, r.sortOrder]));
    expect(byId.get(c.id)).toBe(0);
    expect(byId.get(a.id)).toBe(1);
    expect(byId.get(b.id)).toBe(2);
  });

  it("403s when an id belongs to another location (tenancy)", async () => {
    const other = await createFixture();
    try {
      const mine = await prisma.position.create({ data: { locationId: f.locationId, name: "Mine reorder", sortOrder: 70 } });
      const res = await reorderPositions(reorderRequest({ orderedIds: [mine.id, other.positionIds.server] }));
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("forbidden");
    } finally {
      await destroyFixture(other);
    }
  });

  it("400s on an empty orderedIds array", async () => {
    const res = await reorderPositions(reorderRequest({ orderedIds: [] }));
    expect(res.status).toBe(400);
  });
});
