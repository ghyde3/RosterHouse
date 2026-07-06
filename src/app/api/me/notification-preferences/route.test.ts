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
import { PATCH } from "./route";

const authMock = auth as unknown as Mock;

function patch(body: unknown) {
  return PATCH(
    new Request("http://test.local/api/me/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("PATCH /api/me/notification-preferences", () => {
  let t: TestOrg;
  let emp: { userId: string; profileId: string };

  beforeAll(async () => {
    t = await createTestOrg();
    emp = await createTestEmployee(t, "Maria Test");
    authMock.mockResolvedValue({
      user: { id: emp.userId, name: "Maria Test", role: "employee", organizationId: t.organizationId },
    });
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("updates only the provided channel and returns all three", async () => {
    // Factory defaults: push true, sms true, email false.
    const res = await patch({ notifySms: false });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ notifyPush: true, notifySms: false, notifyEmail: false });
    const profile = await prisma.employeeProfile.findUniqueOrThrow({ where: { id: emp.profileId } });
    expect(profile.notifySms).toBe(false);
    expect(profile.notifyPush).toBe(true);
  });

  it("rejects an empty body", async () => {
    const res = await patch({});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("Provide at least one preference to update.");
  });

  it("rejects non-boolean values", async () => {
    const res = await patch({ notifyPush: "yes" });
    expect(res.status).toBe(400);
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await patch({ notifyPush: false });
    expect(res.status).toBe(401);
  });
});
