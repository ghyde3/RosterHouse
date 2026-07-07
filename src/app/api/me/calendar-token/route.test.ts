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
import { POST } from "./route";

const authMock = auth as unknown as Mock;

function signInAs(userId: string, role: "manager" | "employee", organizationId: string) {
  authMock.mockResolvedValue({
    user: { id: userId, name: "Test", role, organizationId },
  });
}

describe("POST /api/me/calendar-token", () => {
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
    const res = await POST();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      error: { code: "unauthorized", message: "You need to sign in." },
    });
  });

  it("returns 403 for a user with no employee profile", async () => {
    signInAs(t.managerUserId, "manager", t.organizationId);
    const res = await POST();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("no_profile");
  });

  it("mints a token, persists it, and rotates on each call", async () => {
    signInAs(emp.userId, "employee", t.organizationId);

    const first = await POST();
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.ok).toBe(true);
    const firstToken = firstBody.data.token;
    expect(typeof firstToken).toBe("string");
    expect(firstToken.length).toBeGreaterThan(0);

    let profile = await prisma.employeeProfile.findUnique({ where: { id: emp.profileId } });
    expect(profile?.calendarToken).toBe(firstToken);

    const second = await POST();
    const secondBody = await second.json();
    const secondToken = secondBody.data.token;
    expect(secondToken).not.toBe(firstToken);

    profile = await prisma.employeeProfile.findUnique({ where: { id: emp.profileId } });
    expect(profile?.calendarToken).toBe(secondToken);
  });
});
