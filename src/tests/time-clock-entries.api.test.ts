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
import { POST } from "@/app/api/time-clock-entries/route";
import { createFixture, createShiftAt, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function post(body: unknown) {
  return new Request("http://test/api/time-clock-entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/time-clock-entries", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("creates a punch and stamps the audit fields", async () => {
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await POST(
      post({
        employeeProfileId: f.ana.profileId,
        clockInAt: "2026-07-06T13:00:00.000Z",
        clockOutAt: "2026-07-06T21:00:00.000Z",
      }),
    );
    const json = await res.json();
    expect(json.ok).toBe(true);
    const entry = await prisma.timeClockEntry.findUniqueOrThrow({ where: { id: json.data.entry.id } });
    expect(entry.locationId).toBe(f.locationId);
    expect(entry.editedByUserId).toBe(f.managerUserId);
    expect(entry.editedAt).not.toBeNull();
    expect(entry.clockOutAt?.toISOString()).toBe("2026-07-06T21:00:00.000Z");
  });

  it("rejects an employee from another location (404)", async () => {
    const other = await createFixture();
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await POST(
      post({ employeeProfileId: other.ana.profileId, clockInAt: "2026-07-06T13:00:00.000Z" }),
    );
    expect(res.status).toBe(404);
    await destroyFixture(other);
  });

  it("rejects a shift from another location (404)", async () => {
    const other = await createFixture();
    const foreignShift = await createShiftAt(other, {
      positionId: other.positionIds.server,
      employeeProfileId: other.ana.profileId,
      startsAt: new Date("2026-07-06T13:00:00.000Z"),
      endsAt: new Date("2026-07-06T21:00:00.000Z"),
    });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await POST(
      post({
        employeeProfileId: f.ana.profileId,
        clockInAt: "2026-07-06T13:00:00.000Z",
        shiftId: foreignShift.id,
      }),
    );
    expect(res.status).toBe(404);
    await destroyFixture(other);
  });

  it("rejects a non-manager (403)", async () => {
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(post({ employeeProfileId: f.ana.profileId, clockInAt: "2026-07-06T13:00:00.000Z" }));
    expect(res.status).toBe(403);
  });

  it("rejects invalid input (400)", async () => {
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await POST(post({ employeeProfileId: f.ana.profileId, clockInAt: "nope" }));
    expect(res.status).toBe(400);
  });
});
