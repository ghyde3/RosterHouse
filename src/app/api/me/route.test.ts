import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import {
  createTestEmployee,
  createTestOrg,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { GET } from "./route";

const authMock = auth as unknown as Mock;

function signInAs(userId: string, role: "manager" | "employee", organizationId: string) {
  authMock.mockResolvedValue({
    user: { id: userId, name: "Test", role, organizationId },
  });
}

describe("GET /api/me", () => {
  let t: TestOrg;
  let emp: { userId: string; profileId: string };

  beforeAll(async () => {
    t = await createTestOrg();
    emp = await createTestEmployee(t, "Maria Test");
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("returns 401 with the envelope when signed out", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      error: { code: "unauthorized", message: "You need to sign in." },
    });
  });

  it("returns user + profile for an employee", async () => {
    signInAs(emp.userId, "employee", t.organizationId);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.user.firstName).toBe("Maria");
    expect(body.data.user.role).toBe("employee");
    expect(body.data.profile).toMatchObject({
      id: emp.profileId,
      locationId: t.locationId,
      locationName: "Test location",
      timezone: "America/New_York",
      primaryPositionName: "Line cook",
      status: "active",
      notifyPush: true,
      notifySms: true,
      notifyEmail: false,
    });
  });

  it("returns profile: null for a manager with no employee profile", async () => {
    signInAs(t.managerUserId, "manager", t.organizationId);
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.profile).toBeNull();
    expect(body.data.user.role).toBe("manager");
  });
});
