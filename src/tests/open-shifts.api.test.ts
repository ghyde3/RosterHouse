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
import { GET } from "@/app/api/open-shifts/route";
import { POST } from "@/app/api/open-shifts/[shiftId]/claims/route";
import { createFixture, createShift, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function claimReq(shiftId: string) {
  return [
    new Request(`http://test/api/open-shifts/${shiftId}/claims`, { method: "POST" }),
    { params: Promise.resolve({ shiftId }) },
  ] as const;
}

describe("open shifts", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("lists future published unassigned shifts with my claim state", async () => {
    const open = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: null,
      daysFromNow: 3,
      startHour: 16,
      endHour: 22,
    });
    // Noise that must NOT appear:
    await createShift(f, { positionId: f.positionIds.server, employeeProfileId: f.ben.profileId, daysFromNow: 3, startHour: 9, endHour: 17 }); // assigned
    await createShift(f, { positionId: f.positionIds.server, employeeProfileId: null, daysFromNow: -3, startHour: 9, endHour: 17 }); // past
    await createShift(f, { positionId: f.positionIds.server, employeeProfileId: null, daysFromNow: 4, startHour: 9, endHour: 17, status: "draft" }); // draft

    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await GET();
    const json = await res.json();
    expect(json.ok).toBe(true);
    const ids = json.data.openShifts.map((s: { shiftId: string }) => s.shiftId);
    expect(ids).toContain(open.id);
    expect(ids).toHaveLength(1);
    const item = json.data.openShifts[0];
    expect(item.positionName).toBe("Server");
    expect(item.qualified).toBe(true);
    expect(item.myClaimStatus).toBeNull();
    expect(item.timeLabel).toContain("–");
  });

  it("creates a pending claim, annotates it, and blocks duplicates", async () => {
    const open = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: null,
      daysFromNow: 5,
      startHour: 16,
      endHour: 22,
    });
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(...claimReq(open.id));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("pending");

    const list = await (await GET()).json();
    const item = list.data.openShifts.find((s: { shiftId: string }) => s.shiftId === open.id);
    expect(item.myClaimStatus).toBe("pending");

    const dup = await POST(...claimReq(open.id));
    expect(dup.status).toBe(409);
    expect((await dup.json()).error.code).toBe("duplicate_claim");
  });

  it("rejects unqualified claimants with actionable copy", async () => {
    const open = await createShift(f, {
      positionId: f.positionIds.dishwasher,
      employeeProfileId: null,
      daysFromNow: 5,
      startHour: 18,
      endHour: 23,
    });
    signInAs(f.cal.userId, { role: "employee", organizationId: f.orgId }); // Server-only
    const res = await POST(...claimReq(open.id));
    expect(res.status).toBe(403);
    expect((await res.json()).error.message).toBe(
      "Ask your manager to add the Dishwasher position to your profile before claiming this shift.",
    );
  });

  it("rejects claiming an assigned shift", async () => {
    const taken = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ben.profileId,
      daysFromNow: 6,
      startHour: 9,
      endHour: 17,
    });
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(...claimReq(taken.id));
    expect(res.status).toBe(409);
  });
});
