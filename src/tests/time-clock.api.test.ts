// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  requireUser: vi.fn(),
  requireManager: vi.fn(),
  apiUser: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

import { prisma } from "@/lib/db";
import { GET } from "@/app/api/me/time-clock/route";
import { POST as clockIn } from "@/app/api/time-clock/clock-in/route";
import { POST as clockOut } from "@/app/api/time-clock/clock-out/route";
import { createFixture, createShiftAt, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function post(body: unknown) {
  return new Request("http://test/api/time-clock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ON_SITE = { lat: 40.7128, lng: -74.006 }; // fixture location coordinates
const FAR_AWAY = { lat: 34.0522, lng: -118.2437 };

describe("time clock API", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("clock-in on site links the current shift and verifies location", async () => {
    const now = Date.now();
    const shift = await createShiftAt(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      startsAt: new Date(now - 60 * 60 * 1000),
      endsAt: new Date(now + 4 * 60 * 60 * 1000),
    });
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await clockIn(post(ON_SITE));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.locationVerified).toBe(true);
    expect(json.data.positionName).toBe("Server");
    const entry = await prisma.timeClockEntry.findUniqueOrThrow({ where: { id: json.data.entryId } });
    expect(entry.shiftId).toBe(shift.id);
    expect(Number(entry.clockInLat)).toBeCloseTo(ON_SITE.lat, 4);

    // GET reflects the active entry
    const state = await (await GET()).json();
    expect(state.data.activeEntry?.id).toBe(json.data.entryId);

    // Double clock-in is a conflict
    const dup = await clockIn(post(ON_SITE));
    expect(dup.status).toBe(409);

    // Backdate the punch so the elapsed duration is measurable — the
    // clock-in/clock-out calls above happen within milliseconds of each
    // other in test time, which would otherwise round to 0.0 hours.
    await prisma.timeClockEntry.update({
      where: { id: json.data.entryId },
      data: { clockInAt: new Date(now - 2 * 60 * 60 * 1000) },
    });

    // Clock out returns hours worked today
    const out = await clockOut(post(ON_SITE));
    const outJson = await out.json();
    expect(outJson.ok).toBe(true);
    expect(outJson.data.hoursToday).toBeGreaterThan(0);
  });

  it("clock-in far away is recorded and flagged, never blocked", async () => {
    signInAs(f.ben.userId, { role: "employee", organizationId: f.orgId });
    const res = await clockIn(post(FAR_AWAY));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.locationVerified).toBe(false);
    expect(json.data.positionName).toBeNull(); // no shift scheduled now
    await clockOut(post(FAR_AWAY));
  });

  it("clock-in without coordinates records with unknown verification", async () => {
    signInAs(f.cal.userId, { role: "employee", organizationId: f.orgId });
    const res = await clockIn(post({}));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.locationVerified).toBeNull();
    const entry = await prisma.timeClockEntry.findUniqueOrThrow({ where: { id: json.data.entryId } });
    expect(entry.clockInLat).toBeNull();
    await clockOut(post({}));
  });

  it("clock-out without an active entry is a conflict", async () => {
    signInAs(f.cal.userId, { role: "employee", organizationId: f.orgId });
    const res = await clockOut(post({}));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("not_clocked_in");
  });
});
