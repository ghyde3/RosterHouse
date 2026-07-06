import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import {
  createTestEmployee,
  createTestOrg,
  createTestSchedule,
  createTestShift,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { GET } from "./route";

const authMock = auth as unknown as Mock;

// Week of Mon 2026-07-06. New York is UTC-4 in July:
// 7:00 AM local = 11:00Z; 3:00 PM = 19:00Z; 2:00 PM = 18:00Z; 8:00 PM = 00:00Z next day.
const WEEK = "2026-07-06";

function get(from: string, to: string) {
  return GET(new Request(`http://test.local/api/me/shifts?from=${from}&to=${to}`));
}

describe("GET /api/me/shifts", () => {
  let t: TestOrg;
  let emp: { userId: string; profileId: string };
  let other: { userId: string; profileId: string };

  beforeAll(async () => {
    t = await createTestOrg();
    emp = await createTestEmployee(t, "Maria Test");
    other = await createTestEmployee(t, "Sam Test");
    const schedule = await createTestSchedule(t, WEEK, "published");
    // Maria: Mon 7–3 (8 hrs), Wed 7–3 (8 hrs), Fri 2–8 (6 hrs) → 22 hrs.
    await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.lineCook,
      employeeProfileId: emp.profileId,
      date: "2026-07-06",
      startsAt: "2026-07-06T11:00:00.000Z",
      endsAt: "2026-07-06T19:00:00.000Z",
      status: "published",
    });
    await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.lineCook,
      employeeProfileId: emp.profileId,
      date: "2026-07-08",
      startsAt: "2026-07-08T11:00:00.000Z",
      endsAt: "2026-07-08T19:00:00.000Z",
      status: "published",
    });
    await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.server,
      employeeProfileId: emp.profileId,
      date: "2026-07-10",
      startsAt: "2026-07-10T18:00:00.000Z",
      endsAt: "2026-07-11T00:00:00.000Z",
      status: "published",
    });
    // Excluded: Maria's DRAFT shift and Sam's published shift, same week.
    await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.lineCook,
      employeeProfileId: emp.profileId,
      date: "2026-07-09",
      startsAt: "2026-07-09T11:00:00.000Z",
      endsAt: "2026-07-09T19:00:00.000Z",
      status: "draft",
    });
    await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.server,
      employeeProfileId: other.profileId,
      date: "2026-07-06",
      startsAt: "2026-07-06T11:00:00.000Z",
      endsAt: "2026-07-06T19:00:00.000Z",
      status: "published",
    });
    authMock.mockResolvedValue({
      user: { id: emp.userId, name: "Maria Test", role: "employee", organizationId: t.organizationId },
    });
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("returns only my published shifts, sorted, with a summary", async () => {
    const res = await get("2026-07-06", "2026-07-12");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.shifts).toHaveLength(3);
    expect(body.data.shifts.map((s: { date: string }) => s.date)).toEqual([
      "2026-07-06",
      "2026-07-08",
      "2026-07-10",
    ]);
    expect(body.data.shifts[0]).toMatchObject({
      positionName: "Line cook",
      timeRange: "7:00 AM – 3:00 PM",
      durationHours: 8,
    });
    expect(body.data.summary).toEqual({ shiftCount: 3, totalHours: 22 });
  });

  it("returns an empty list outside the range", async () => {
    const res = await get("2026-07-13", "2026-07-19");
    const body = await res.json();
    expect(body.data.shifts).toHaveLength(0);
    expect(body.data.summary).toEqual({ shiftCount: 0, totalHours: 0 });
  });

  it("rejects bad query params with a specific message", async () => {
    const res = await get("2026-07-12", "2026-07-06");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("The from date must be on or before the to date.");
  });

  it("returns 403 no_profile for a user without an employee profile", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: t.managerUserId, name: "Test Manager", role: "manager", organizationId: t.organizationId },
    });
    const res = await get("2026-07-06", "2026-07-12");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("no_profile");
  });
});
