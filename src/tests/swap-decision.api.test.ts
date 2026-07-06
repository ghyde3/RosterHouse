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
import { PATCH } from "@/app/api/swap-requests/[id]/route";
import { createFixture, createShift, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function patchReq(id: string, decision: "approve" | "deny") {
  return [
    new Request(`http://test/api/swap-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

async function makeSwap(f: Fixture, opts: { covererProfileId: string | null; daysFromNow: number; startHour?: number; endHour?: number }) {
  const shift = await createShift(f, {
    positionId: f.positionIds.server,
    employeeProfileId: f.ana.profileId,
    daysFromNow: opts.daysFromNow,
    startHour: opts.startHour ?? 16,
    endHour: opts.endHour ?? 22,
  });
  const request = await prisma.swapRequest.create({
    data: { shiftId: shift.id, requestingEmployeeProfileId: f.ana.profileId, coveringEmployeeProfileId: opts.covererProfileId },
  });
  return { shift, request };
}

describe("PATCH /api/swap-requests/[id]", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("approve with a named coverer reassigns the shift and notifies both people", async () => {
    const { shift, request } = await makeSwap(f, { covererProfileId: f.ben.profileId, daysFromNow: 4 });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(request.id, "approve"));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("approved");
    expect(json.data.warnings).toEqual([]);

    const updatedShift = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(updatedShift.employeeProfileId).toBe(f.ben.profileId);

    const requesterNote = await prisma.notification.findFirst({
      where: { userId: f.ana.userId, type: "swap_approved" },
      orderBy: { createdAt: "desc" },
    });
    expect(requesterNote?.body).toContain("Ben Cho will cover your");
    const covererNote = await prisma.notification.findFirst({
      where: { userId: f.ben.userId, type: "swap_approved" },
      orderBy: { createdAt: "desc" },
    });
    expect(covererNote?.body).toContain("You're covering Ana Diaz's");
  });

  it("approve of an open-to-anyone request opens the shift", async () => {
    const { shift, request } = await makeSwap(f, { covererProfileId: null, daysFromNow: 5 });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(request.id, "approve"));
    expect((await res.json()).data.status).toBe("approved");
    const updatedShift = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(updatedShift.employeeProfileId).toBeNull();
  });

  it("deny changes nothing on the schedule and notifies both people", async () => {
    const { shift, request } = await makeSwap(f, { covererProfileId: f.ben.profileId, daysFromNow: 6 });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(request.id, "deny"));
    expect((await res.json()).data.status).toBe("denied");
    const updatedShift = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(updatedShift.employeeProfileId).toBe(f.ana.profileId);
    const covererNote = await prisma.notification.findFirst({
      where: { userId: f.ben.userId, type: "swap_denied" },
      orderBy: { createdAt: "desc" },
    });
    expect(covererNote?.body).toContain("Nothing changes for you.");
  });

  it("approving a swap that double-books the coverer returns 200 with warnings", async () => {
    // Ben already works 15:00–23:00 that day; the swapped shift is 16:00–22:00.
    await createShift(f, {
      positionId: f.positionIds.dishwasher,
      employeeProfileId: f.ben.profileId,
      daysFromNow: 8,
      startHour: 15,
      endHour: 23,
    });
    const { shift, request } = await makeSwap(f, { covererProfileId: f.ben.profileId, daysFromNow: 8 });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(request.id, "approve"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.warnings.length).toBeGreaterThanOrEqual(1);
    expect(json.data.warnings.some((w: { kind: string }) => w.kind === "double_booked")).toBe(true);
    // The reassignment still happened — the manager approved with eyes open.
    const updatedShift = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(updatedShift.employeeProfileId).toBe(f.ben.profileId);
  });

  it("returns 409 on a second decision", async () => {
    const { request } = await makeSwap(f, { covererProfileId: null, daysFromNow: 9 });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    await PATCH(...patchReq(request.id, "deny"));
    const res = await PATCH(...patchReq(request.id, "approve"));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("already_decided");
  });

  it("returns 409 with a calm envelope if the shift was reassigned mid-flight, without reassigning it", async () => {
    // The route's pre-check (before the transaction) already catches a shift
    // that visibly changed by the time it re-fetches the request — that's
    // covered implicitly elsewhere. This test targets the *narrower* race the
    // guarded `tx.shift.updateMany` exists for: the shift changes in the
    // window between the route's read and the transaction's write. We
    // reproduce that window by stubbing the initial `findUnique` to return
    // stale data (as if read a moment before a concurrent change lands),
    // while the real row underneath has already moved to Cal.
    const { shift, request } = await makeSwap(f, { covererProfileId: f.ben.profileId, daysFromNow: 10 });
    const staleRequest = await prisma.swapRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: {
        shift: { include: { position: true, location: true } },
        requester: { include: { user: true } },
        coverer: { include: { user: true } },
      },
    });
    await prisma.shift.update({ where: { id: shift.id }, data: { employeeProfileId: f.cal.profileId } });

    const spy = vi.spyOn(prisma.swapRequest, "findUnique").mockResolvedValueOnce(staleRequest as never);
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(request.id, "approve"));
    spy.mockRestore();

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("shift_changed");
    expect(body.error.message).toBe("That shift changed before you could approve. Refresh and try again.");

    // The shift must remain assigned to whoever it was reassigned to — the
    // guarded update must not have clobbered it.
    const unchanged = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(unchanged.employeeProfileId).toBe(f.cal.profileId);

    // The swap request itself must not be left "approved" with a shift that
    // disagrees — the whole transaction should have rolled back.
    const requestAfter = await prisma.swapRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(requestAfter.status).toBe("pending");
  });
});
