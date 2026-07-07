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
import { GET } from "@/app/api/locations/[locationId]/timesheets/export/route";
import { createFixture, createShiftAt, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";
import { localToUtc } from "@/lib/time";

const WEEK = "2026-07-06";
function at(dateISO: string, hour: number) {
  return localToUtc(dateISO, { hour, minute: 0 }, "America/New_York");
}
function ctx(locationId: string) {
  return { params: Promise.resolve({ locationId }) };
}
function req(locationId: string, weekStart: string) {
  return new Request(
    `http://test/api/locations/${locationId}/timesheets/export?weekStart=${weekStart}`,
  );
}

describe("GET timesheets export", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
    const shift = await createShiftAt(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      startsAt: at(WEEK, 9),
      endsAt: at(WEEK, 17),
    });
    await prisma.timeClockEntry.create({
      data: {
        employeeProfileId: f.ana.profileId,
        locationId: f.locationId,
        shiftId: shift.id,
        clockInAt: at(WEEK, 9),
        clockOutAt: at(WEEK, 17),
      },
    });
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("returns text/csv rows for the week", async () => {
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await GET(req(f.locationId, WEEK), ctx(f.locationId));
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    const lines = body.trim().split("\n");
    expect(lines[0]).toBe("Employee,Date,Clock in,Clock out,Hours,Cost,Flags");
    expect(body).toContain("Ana Diaz");
    expect(lines).toHaveLength(2); // header + one entry
  });

  it("rejects another location (403)", async () => {
    const other = await createFixture();
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await GET(req(other.locationId, WEEK), ctx(other.locationId));
    expect(res.status).toBe(403);
    await destroyFixture(other);
  });

  it("rejects a non-Monday weekStart (400)", async () => {
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await GET(req(f.locationId, "2026-07-07"), ctx(f.locationId));
    expect(res.status).toBe(400);
  });
});
