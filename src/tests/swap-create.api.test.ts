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
import { POST } from "@/app/api/shifts/[shiftId]/swap-requests/route";
import { listQualifiedCoworkers } from "@/lib/requests";
import { createFixture, createShift, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function req(shiftId: string, body: unknown) {
  return [
    new Request(`http://test/api/shifts/${shiftId}/swap-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ shiftId }) },
  ] as const;
}

describe("POST /api/shifts/[shiftId]/swap-requests", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("creates a pending open-to-anyone request for my own future published shift", async () => {
    const shift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 4,
      startHour: 16,
      endHour: 22,
    });
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(...req(shift.id, { coveringEmployeeProfileId: null, note: "Family dinner that night." }));
    const json = await res.json();
    expect(json.ok).toBe(true);
    const row = await prisma.swapRequest.findUniqueOrThrow({ where: { id: json.data.id } });
    expect(row.status).toBe("pending");
    expect(row.coveringEmployeeProfileId).toBeNull();
    expect(row.requestingEmployeeProfileId).toBe(f.ana.profileId);
  });

  it("enforces one open request per shift", async () => {
    const shift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 5,
      startHour: 9,
      endHour: 17,
    });
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const first = await POST(...req(shift.id, { coveringEmployeeProfileId: null }));
    expect((await first.json()).ok).toBe(true);
    const second = await POST(...req(shift.id, { coveringEmployeeProfileId: f.ben.profileId }));
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe("duplicate_request");
  });

  it("rejects requesting a swap for someone else's shift", async () => {
    const shift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 6,
      startHour: 9,
      endHour: 17,
    });
    signInAs(f.cal.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(...req(shift.id, { coveringEmployeeProfileId: null }));
    expect(res.status).toBe(403);
  });

  it("rejects an unqualified named coverer with a specific message", async () => {
    const shift = await createShift(f, {
      positionId: f.positionIds.dishwasher,
      employeeProfileId: f.ben.profileId,
      daysFromNow: 6,
      startHour: 18,
      endHour: 23,
    });
    signInAs(f.ben.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(...req(shift.id, { coveringEmployeeProfileId: f.cal.profileId })); // Cal is Server-only
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe("Cal Ito isn't qualified for Dishwasher shifts.");
  });

  it("rejects past shifts", async () => {
    const shift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: -2,
      startHour: 9,
      endHour: 17,
    });
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(...req(shift.id, { coveringEmployeeProfileId: null }));
    expect(res.status).toBe(409);
  });

  it("lists only qualified, active coworkers excluding the requester", async () => {
    const coworkers = await listQualifiedCoworkers(f.locationId, f.positionIds.dishwasher, f.ana.profileId);
    expect(coworkers.map((c) => c.name)).toEqual(["Ben Cho"]);
  });
});
