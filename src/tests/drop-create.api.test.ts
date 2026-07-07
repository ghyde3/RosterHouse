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
import { POST } from "@/app/api/shifts/[shiftId]/drop-requests/route";
import { createFixture, createShift, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function req(shiftId: string, body: unknown) {
  return [
    new Request(`http://test/api/shifts/${shiftId}/drop-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ shiftId }) },
  ] as const;
}

describe("POST /api/shifts/[shiftId]/drop-requests", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("creates a pending drop request for my own future published shift", async () => {
    const shift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 4,
      startHour: 16,
      endHour: 22,
    });
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(...req(shift.id, { note: "Family dinner that night." }));
    const json = await res.json();
    expect(json.ok).toBe(true);
    const row = await prisma.dropRequest.findUniqueOrThrow({ where: { id: json.data.id } });
    expect(row.status).toBe("pending");
    expect(row.requestingEmployeeProfileId).toBe(f.ana.profileId);
    expect(row.note).toBe("Family dinner that night.");
  });

  it("enforces one pending drop request per shift per requester", async () => {
    const shift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 5,
      startHour: 9,
      endHour: 17,
    });
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const first = await POST(...req(shift.id, {}));
    expect((await first.json()).ok).toBe(true);
    const second = await POST(...req(shift.id, {}));
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe("duplicate_request");
  });

  it("rejects asking to drop someone else's shift", async () => {
    const shift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 6,
      startHour: 9,
      endHour: 17,
    });
    signInAs(f.cal.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(...req(shift.id, {}));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("forbidden");
  });

  it("rejects unpublished shifts", async () => {
    const shift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 7,
      startHour: 9,
      endHour: 17,
      status: "draft",
      scheduleStatus: "draft",
    });
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(...req(shift.id, {}));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("not_published");
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
    const res = await POST(...req(shift.id, {}));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("shift_started");
  });

  it("returns 401 when signed out", async () => {
    const shift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 8,
      startHour: 9,
      endHour: 17,
    });
    const { signOutAll } = await import("./helpers/auth");
    signOutAll();
    const res = await POST(...req(shift.id, {}));
    expect(res.status).toBe(401);
  });
});
