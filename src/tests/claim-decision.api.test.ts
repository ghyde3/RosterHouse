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
import { PATCH } from "@/app/api/open-shift-claims/[claimId]/route";
import { createFixture, createShift, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function patchReq(claimId: string, decision: "approve" | "deny") {
  return [
    new Request(`http://test/api/open-shift-claims/${claimId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    }),
    { params: Promise.resolve({ claimId }) },
  ] as const;
}

describe("PATCH /api/open-shift-claims/[claimId]", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("approve assigns the shift, auto-denies competing claims, and notifies everyone", async () => {
    const open = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: null,
      daysFromNow: 4,
      startHour: 16,
      endHour: 22,
    });
    const anaClaim = await prisma.openShiftClaim.create({ data: { shiftId: open.id, employeeProfileId: f.ana.profileId } });
    const calClaim = await prisma.openShiftClaim.create({ data: { shiftId: open.id, employeeProfileId: f.cal.profileId } });

    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(anaClaim.id, "approve"));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("approved");
    expect(json.data.warnings).toEqual([]);

    const shift = await prisma.shift.findUniqueOrThrow({ where: { id: open.id } });
    expect(shift.employeeProfileId).toBe(f.ana.profileId);

    const loser = await prisma.openShiftClaim.findUniqueOrThrow({ where: { id: calClaim.id } });
    expect(loser.status).toBe("denied");
    expect(loser.decidedByUserId).toBe(f.managerUserId);

    const winNote = await prisma.notification.findFirst({
      where: { userId: f.ana.userId, type: "claim_approved" },
      orderBy: { createdAt: "desc" },
    });
    expect(winNote?.body).toContain("is yours");
    const loseNote = await prisma.notification.findFirst({
      where: { userId: f.cal.userId, type: "claim_denied" },
      orderBy: { createdAt: "desc" },
    });
    expect(loseNote?.body).toContain("went to another teammate");
  });

  it("deny keeps the shift open and notifies the claimant", async () => {
    const open = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: null,
      daysFromNow: 5,
      startHour: 9,
      endHour: 17,
    });
    const claim = await prisma.openShiftClaim.create({ data: { shiftId: open.id, employeeProfileId: f.ben.profileId } });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(claim.id, "deny"));
    expect((await res.json()).data.status).toBe("denied");
    const shift = await prisma.shift.findUniqueOrThrow({ where: { id: open.id } });
    expect(shift.employeeProfileId).toBeNull();
    const note = await prisma.notification.findFirst({
      where: { userId: f.ben.userId, type: "claim_denied" },
      orderBy: { createdAt: "desc" },
    });
    expect(note?.body).toContain("was denied");
  });

  it("approving a claim that double-books the claimant returns 200 with warnings", async () => {
    await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.cal.profileId,
      daysFromNow: 8,
      startHour: 15,
      endHour: 23,
    });
    const open = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: null,
      daysFromNow: 8,
      startHour: 16,
      endHour: 22,
    });
    const claim = await prisma.openShiftClaim.create({ data: { shiftId: open.id, employeeProfileId: f.cal.profileId } });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(...patchReq(claim.id, "approve"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.warnings.some((w: { kind: string }) => w.kind === "double_booked")).toBe(true);
  });

  it("returns 409 when the shift was already filled", async () => {
    const open = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: null,
      daysFromNow: 9,
      startHour: 9,
      endHour: 17,
    });
    const first = await prisma.openShiftClaim.create({ data: { shiftId: open.id, employeeProfileId: f.ana.profileId } });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    await PATCH(...patchReq(first.id, "approve"));
    // A late claim on the now-filled shift (created before approval in real life;
    // simulate by inserting directly, bypassing the API's open check).
    const late = await prisma.openShiftClaim.create({ data: { shiftId: open.id, employeeProfileId: f.ben.profileId } });
    const res = await PATCH(...patchReq(late.id, "approve"));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("already_filled");
  });
});
