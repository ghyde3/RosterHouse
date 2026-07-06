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

function get(shiftId: string) {
  return GET(new Request(`http://test.local/api/shifts/${shiftId}`), {
    params: Promise.resolve({ shiftId }),
  });
}

describe("GET /api/shifts/[shiftId]", () => {
  let t: TestOrg;
  let maria: { userId: string; profileId: string };
  let sam: { userId: string; profileId: string };
  let alex: { userId: string; profileId: string };
  let myShiftId: string;
  let openShiftId: string;
  let samsShiftId: string;
  let myDraftShiftId: string;

  beforeAll(async () => {
    t = await createTestOrg();
    maria = await createTestEmployee(t, "Maria Test");
    sam = await createTestEmployee(t, "Sam Test");
    alex = await createTestEmployee(t, "Alex Test");
    const schedule = await createTestSchedule(t, "2026-07-06", "published");
    // Maria, Mon Jul 6, 7:00 AM – 3:00 PM (11:00Z–19:00Z), with a note.
    myShiftId = await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.lineCook,
      employeeProfileId: maria.profileId,
      date: "2026-07-06",
      startsAt: "2026-07-06T11:00:00.000Z",
      endsAt: "2026-07-06T19:00:00.000Z",
      status: "published",
      notes: "Bring your own knife kit.",
    });
    // Sam overlaps Maria (2:00 PM – 8:00 PM) → coworker.
    samsShiftId = await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.server,
      employeeProfileId: sam.profileId,
      date: "2026-07-06",
      startsAt: "2026-07-06T18:00:00.000Z",
      endsAt: "2026-07-07T00:00:00.000Z",
      status: "published",
    });
    // Alex same day but NOT overlapping (4:00 PM – 10:00 PM starts after
    // Maria ends? 20:00Z–2:00Z overlaps 11–19Z? No: starts 20:00Z > 19:00Z) → excluded.
    await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.server,
      employeeProfileId: alex.profileId,
      date: "2026-07-06",
      startsAt: "2026-07-06T20:00:00.000Z",
      endsAt: "2026-07-07T02:00:00.000Z",
      status: "published",
    });
    // Open shift at the same location, published.
    openShiftId = await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.server,
      employeeProfileId: null,
      date: "2026-07-11",
      startsAt: "2026-07-11T20:00:00.000Z",
      endsAt: "2026-07-12T02:00:00.000Z",
      status: "published",
    });
    // Maria's draft shift — invisible to her until published.
    myDraftShiftId = await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.lineCook,
      employeeProfileId: maria.profileId,
      date: "2026-07-09",
      startsAt: "2026-07-09T11:00:00.000Z",
      endsAt: "2026-07-09T19:00:00.000Z",
      status: "draft",
    });
    authMock.mockResolvedValue({
      user: { id: maria.userId, name: "Maria Test", role: "employee", organizationId: t.organizationId },
    });
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("returns my published shift with overlapping coworkers only", async () => {
    const res = await get(myShiftId);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      id: myShiftId,
      date: "2026-07-06",
      dayLabel: "Mon Jul 6",
      positionName: "Line cook",
      isOpen: false,
      timeRange: "7:00 AM – 3:00 PM",
      durationHours: 8,
      notes: "Bring your own knife kit.",
      location: { name: "Test location", address: "1 Test St", timezone: "America/New_York" },
    });
    expect(body.data.coworkers).toEqual([{ name: "Sam Test", positionName: "Server" }]);
  });

  it("returns an open shift at my location", async () => {
    const res = await get(openShiftId);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.isOpen).toBe(true);
  });

  it("hides another employee's shift as 404", async () => {
    const res = await get(samsShiftId);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
  });

  it("hides my own draft shift as 404", async () => {
    const res = await get(myDraftShiftId);
    expect(res.status).toBe(404);
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await get(myShiftId);
    expect(res.status).toBe(401);
  });
});
