import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/authz", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/authz")>();
  return { ...mod }; // real authz; only auth is mocked
});

import { auth } from "@/lib/auth";
import {
  createTestEmployee,
  createTestOrg,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { GET } from "./route";

const authMock = auth as unknown as Mock;

function get(locationId: string, week?: string) {
  const qs = week ? `?week=${week}` : "";
  return GET(new Request(`http://test.local/api/locations/${locationId}/availability${qs}`), {
    params: Promise.resolve({ locationId }),
  });
}

describe("GET /api/locations/[locationId]/availability", () => {
  let mine: TestOrg;
  let other: TestOrg;

  beforeAll(async () => {
    mine = await createTestOrg();
    other = await createTestOrg();
    await createTestEmployee(mine, "Maria Test");
  });

  afterAll(async () => {
    await deleteTestOrg(mine.organizationId);
    await deleteTestOrg(other.organizationId);
  });

  it("returns the week for the manager's own location", async () => {
    authMock.mockResolvedValue({
      user: { id: mine.managerUserId, name: "Test Manager", role: "manager", organizationId: mine.organizationId },
    });
    const res = await get(mine.locationId, "2026-07-06");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.weekStart).toBe("2026-07-06");
    expect(body.data.employees).toHaveLength(1);
  });

  it("rejects an employee caller", async () => {
    const emp = await createTestEmployee(mine, "Sam Test");
    authMock.mockResolvedValueOnce({
      user: { id: emp.userId, name: "Sam Test", role: "employee", organizationId: mine.organizationId },
    });
    const res = await get(mine.locationId, "2026-07-06");
    expect(res.status).toBe(403);
  });

  it("rejects a manager from another organization's location", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: other.managerUserId, name: "Other Manager", role: "manager", organizationId: other.organizationId },
    });
    const res = await get(mine.locationId, "2026-07-06");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toBe("You don't have access to this location.");
  });

  it("rejects a malformed week", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: mine.managerUserId, name: "Test Manager", role: "manager", organizationId: mine.organizationId },
    });
    const res = await get(mine.locationId, "July-6");
    expect(res.status).toBe(400);
  });
});
