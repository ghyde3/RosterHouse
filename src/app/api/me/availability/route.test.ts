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
import { GET, PUT } from "./route";

const authMock = auth as unknown as Mock;

function rules(overrides: Partial<Record<number, { isAvailable?: boolean; startTime?: string | null; endTime?: string | null }>> = {}) {
  return Array.from({ length: 7 }, (_, d) => ({
    dayOfWeek: d,
    isAvailable: overrides[d]?.isAvailable ?? true,
    startTime: overrides[d]?.startTime ?? null,
    endTime: overrides[d]?.endTime ?? null,
  }));
}

function put(body: unknown) {
  return PUT(
    new Request("http://test.local/api/me/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("/api/me/availability", () => {
  let t: TestOrg;
  let emp: { userId: string; profileId: string };

  beforeAll(async () => {
    t = await createTestOrg();
    emp = await createTestEmployee(t, "Priya Test");
    authMock.mockResolvedValue({
      user: { id: emp.userId, name: "Priya Test", role: "employee", organizationId: t.organizationId },
    });
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("GET returns 7 default rules when none are stored", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.rules).toHaveLength(7);
    expect(body.data.rules[0]).toEqual({
      dayOfWeek: 0,
      isAvailable: true,
      startTime: null,
      endTime: null,
    });
  });

  it("PUT replaces all 7 rules in a transaction", async () => {
    const first = rules({ 0: { startTime: "09:00", endTime: "17:00" }, 5: { isAvailable: false }, 6: { isAvailable: false } });
    const res = await put({ rules: first });
    expect(res.status).toBe(200);
    let stored = await prisma.availabilityRule.findMany({
      where: { employeeProfileId: emp.profileId },
      orderBy: { dayOfWeek: "asc" },
    });
    expect(stored).toHaveLength(7);
    expect(stored[0].startTime).toBe("09:00");
    expect(stored[5].isAvailable).toBe(false);

    // Second PUT fully replaces the first.
    const second = rules({ 0: { startTime: "10:00", endTime: "16:00" } });
    await put({ rules: second });
    stored = await prisma.availabilityRule.findMany({
      where: { employeeProfileId: emp.profileId },
      orderBy: { dayOfWeek: "asc" },
    });
    expect(stored).toHaveLength(7);
    expect(stored[0].startTime).toBe("10:00");
    expect(stored[5].isAvailable).toBe(true);
  });

  it("PUT rejects a payload without one rule per day", async () => {
    const res = await put({ rules: rules().slice(0, 6) });
    expect(res.status).toBe(400);
  });

  it("PUT rejects end before start with a specific message", async () => {
    const res = await put({ rules: rules({ 0: { startTime: "17:00", endTime: "09:00" } }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("End time must be after start time.");
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
