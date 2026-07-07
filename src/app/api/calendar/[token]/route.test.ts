import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createTestEmployee,
  createTestOrg,
  createTestSchedule,
  createTestShift,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { GET } from "./route";

function get(token: string) {
  return GET(new Request(`http://test.local/api/calendar/${token}`), {
    params: Promise.resolve({ token }),
  });
}

// Service dates relative to "now" so the 14-day lookback window behaves the
// same whenever the suite runs.
function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe("GET /api/calendar/[token]", () => {
  let t: TestOrg;
  let maria: { userId: string; profileId: string };
  let token: string;
  let upcomingShiftId: string;
  let draftShiftId: string;
  let openShiftId: string;
  let oldShiftId: string;

  beforeAll(async () => {
    t = await createTestOrg();
    maria = await createTestEmployee(t, "Maria Test");
    token = randomUUID();
    await prisma.employeeProfile.update({
      where: { id: maria.profileId },
      data: { calendarToken: token },
    });

    const schedule = await createTestSchedule(t, "2026-07-06", "published");
    const soon = isoDaysFromNow(3);
    upcomingShiftId = await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.lineCook,
      employeeProfileId: maria.profileId,
      date: soon,
      startsAt: `${soon}T11:00:00.000Z`,
      endsAt: `${soon}T19:00:00.000Z`,
      status: "published",
      notes: "Bring your own knife kit.",
    });
    // Draft shift → excluded.
    const draftDay = isoDaysFromNow(4);
    draftShiftId = await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.lineCook,
      employeeProfileId: maria.profileId,
      date: draftDay,
      startsAt: `${draftDay}T11:00:00.000Z`,
      endsAt: `${draftDay}T19:00:00.000Z`,
      status: "draft",
    });
    // Unassigned open shift → excluded.
    const openDay = isoDaysFromNow(5);
    openShiftId = await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.server,
      employeeProfileId: null,
      date: openDay,
      startsAt: `${openDay}T20:00:00.000Z`,
      endsAt: `${openDay}T23:00:00.000Z`,
      status: "published",
    });
    // Published but far in the past (before the 14-day window) → excluded.
    const oldDay = isoDaysFromNow(-30);
    oldShiftId = await createTestShift(t, {
      scheduleId: schedule,
      positionId: t.positions.lineCook,
      employeeProfileId: maria.profileId,
      date: oldDay,
      startsAt: `${oldDay}T11:00:00.000Z`,
      endsAt: `${oldDay}T19:00:00.000Z`,
      status: "published",
    });
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("serves an ics feed with the published assigned shift", async () => {
    const res = await get(token);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('inline; filename="rosterhouse.ics"');
    expect(res.headers.get("cache-control")).toBe("no-cache");

    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR\r\n");
    expect(body).toContain(`UID:${upcomingShiftId}@rosterhouse\r\n`);
    expect(body).toContain("SUMMARY:Line cook shift\r\n");
    expect(body).toContain("LOCATION:Test location\r\n");
    expect(body).toContain("DESCRIPTION:Bring your own knife kit.\r\n");
    expect(body).toContain("END:VCALENDAR\r\n");
  });

  it("excludes draft, unassigned, and out-of-window shifts", async () => {
    const res = await get(token);
    const body = await res.text();
    expect(body).not.toContain(draftShiftId);
    expect(body).not.toContain(openShiftId);
    expect(body).not.toContain(oldShiftId);
  });

  it("returns 404 for an unknown token", async () => {
    const res = await get(randomUUID());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      error: { code: "calendar_not_found", message: "This calendar link is no longer valid." },
    });
  });
});
