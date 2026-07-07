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
import { PATCH } from "@/app/api/drop-requests/[id]/route";
import { createFixture, createShift, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function patchReq(id: string, decision: "approve" | "deny") {
  return [
    new Request(`http://test/api/drop-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

async function makeDrop(f: Fixture, opts: { daysFromNow: number; startHour?: number; endHour?: number }) {
  const shift = await createShift(f, {
    positionId: f.positionIds.server,
    employeeProfileId: f.ana.profileId,
    daysFromNow: opts.daysFromNow,
    startHour: opts.startHour ?? 16,
    endHour: opts.endHour ?? 22,
  });
  const request = await prisma.dropRequest.create({
    data: { shiftId: shift.id, requestingEmployeeProfileId: f.ana.profileId },
  });
  return { shift, request };
}

describe("PATCH /api/drop-requests/[id]", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("approve unassigns the shift and notifies the requester", async () => {
    const { shift, request } = await makeDrop(f, { daysFromNow: 4 });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(request.id, "approve"));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("approved");

    const updatedShift = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(updatedShift.employeeProfileId).toBeNull();

    const requestAfter = await prisma.dropRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(requestAfter.status).toBe("approved");
    expect(requestAfter.decidedByUserId).toBe(f.managerUserId);
    expect(requestAfter.decidedAt).not.toBeNull();

    const note = await prisma.notification.findFirst({
      where: { userId: f.ana.userId, type: "drop_approved" },
      orderBy: { createdAt: "desc" },
    });
    expect(note?.title).toBe("Drop approved");
    expect(note?.body).toContain("open shift");
    expect(note?.body).toContain("Server shift");
  });

  it("deny keeps the assignment and notifies the requester", async () => {
    const { shift, request } = await makeDrop(f, { daysFromNow: 5 });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(request.id, "deny"));
    expect((await res.json()).data.status).toBe("denied");

    const updatedShift = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(updatedShift.employeeProfileId).toBe(f.ana.profileId);

    const note = await prisma.notification.findFirst({
      where: { userId: f.ana.userId, type: "drop_denied" },
      orderBy: { createdAt: "desc" },
    });
    expect(note?.body).toContain("You're still scheduled.");
  });

  it("returns 409 on a second decision", async () => {
    const { request } = await makeDrop(f, { daysFromNow: 6 });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    await PATCH(...patchReq(request.id, "deny"));
    const res = await PATCH(...patchReq(request.id, "approve"));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("already_decided");
  });

  it("returns 409 drop_stale when the shift's assignee changed since the request", async () => {
    const { shift, request } = await makeDrop(f, { daysFromNow: 7 });
    await prisma.shift.update({ where: { id: shift.id }, data: { employeeProfileId: f.cal.profileId } });

    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(request.id, "approve"));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("drop_stale");

    // Nothing moved: the shift keeps its new assignee and the request stays pending.
    const unchanged = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(unchanged.employeeProfileId).toBe(f.cal.profileId);
    const requestAfter = await prisma.dropRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(requestAfter.status).toBe("pending");
  });

  it("rolls back if the shift is reassigned mid-flight, between the read and the transaction", async () => {
    const { shift, request } = await makeDrop(f, { daysFromNow: 8 });
    const staleRequest = await prisma.dropRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: {
        shift: { include: { position: true, location: true } },
        requester: { include: { user: true } },
      },
    });
    await prisma.shift.update({ where: { id: shift.id }, data: { employeeProfileId: f.cal.profileId } });

    const spy = vi.spyOn(prisma.dropRequest, "findUnique").mockResolvedValueOnce(staleRequest as never);
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(request.id, "approve"));
    spy.mockRestore();

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("drop_stale");

    const unchanged = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(unchanged.employeeProfileId).toBe(f.cal.profileId);
    const requestAfter = await prisma.dropRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(requestAfter.status).toBe("pending");
  });

  it("rejects employees", async () => {
    const { request } = await makeDrop(f, { daysFromNow: 9 });
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await PATCH(...patchReq(request.id, "approve"));
    expect(res.status).toBe(403);
  });
});
