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
import { PATCH, DELETE } from "@/app/api/time-clock-entries/[id]/route";
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

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}
function patch(body: unknown) {
  return new Request("http://test/api/time-clock-entries/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/time-clock-entries/[id]", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("edits the clock-out and re-stamps the audit", async () => {
    const entry = await prisma.timeClockEntry.create({
      data: {
        employeeProfileId: f.ana.profileId,
        locationId: f.locationId,
        clockInAt: new Date("2026-07-06T13:00:00.000Z"),
        clockOutAt: null,
      },
    });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(patch({ clockOutAt: "2026-07-06T21:00:00.000Z" }), ctx(entry.id));
    const json = await res.json();
    expect(json.ok).toBe(true);
    const after = await prisma.timeClockEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(after.clockOutAt?.toISOString()).toBe("2026-07-06T21:00:00.000Z");
    expect(after.editedByUserId).toBe(f.managerUserId);
    expect(after.editedAt).not.toBeNull();

    // The edit lands in the org's audit trail with only the changed punch fields.
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { organizationId: f.orgId, action: "timeclock.edited", entityId: entry.id },
    });
    expect(audit.locationId).toBe(f.locationId);
    expect(audit.actorUserId).toBe(f.managerUserId);
    expect(audit.actorName).toBe("Test User"); // signInAs default session name
    expect(audit.entityType).toBe("TimeClockEntry");
    expect(audit.detail).toEqual({
      before: { clockOutAt: null },
      after: { clockOutAt: "2026-07-06T21:00:00.000Z" },
    });
  });

  it("rejects an entry from another location (404)", async () => {
    const other = await createFixture();
    const foreign = await prisma.timeClockEntry.create({
      data: {
        employeeProfileId: other.ana.profileId,
        locationId: other.locationId,
        clockInAt: new Date("2026-07-06T13:00:00.000Z"),
      },
    });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(patch({ clockOutAt: "2026-07-06T21:00:00.000Z" }), ctx(foreign.id));
    expect(res.status).toBe(404);
    await destroyFixture(other);
  });

  it("rejects invalid input (400)", async () => {
    const entry = await prisma.timeClockEntry.create({
      data: {
        employeeProfileId: f.ana.profileId,
        locationId: f.locationId,
        clockInAt: new Date("2026-07-06T13:00:00.000Z"),
      },
    });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(patch({ clockInAt: "nope" }), ctx(entry.id));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/time-clock-entries/[id]", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("deletes the entry", async () => {
    const entry = await prisma.timeClockEntry.create({
      data: {
        employeeProfileId: f.ana.profileId,
        locationId: f.locationId,
        clockInAt: new Date("2026-07-06T13:00:00.000Z"),
      },
    });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await DELETE(new Request("http://test/x", { method: "DELETE" }), ctx(entry.id));
    expect((await res.json()).data.deleted).toBe(true);
    expect(await prisma.timeClockEntry.findUnique({ where: { id: entry.id } })).toBeNull();
  });

  it("rejects an entry from another location (404)", async () => {
    const other = await createFixture();
    const foreign = await prisma.timeClockEntry.create({
      data: {
        employeeProfileId: other.ana.profileId,
        locationId: other.locationId,
        clockInAt: new Date("2026-07-06T13:00:00.000Z"),
      },
    });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await DELETE(new Request("http://test/x", { method: "DELETE" }), ctx(foreign.id));
    expect(res.status).toBe(404);
    await destroyFixture(other);
  });
});
