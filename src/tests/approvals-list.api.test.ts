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
import { GET } from "@/app/api/locations/[locationId]/approvals/route";
import { createFixture, createShift, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

describe("GET /api/locations/[locationId]/approvals", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
    const myShift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 4,
      startHour: 16,
      endHour: 22,
    });
    const openShift = await createShift(f, {
      positionId: f.positionIds.dishwasher,
      employeeProfileId: null,
      daysFromNow: 5,
      startHour: 18,
      endHour: 23,
    });
    await prisma.swapRequest.create({
      data: { shiftId: myShift.id, requestingEmployeeProfileId: f.ana.profileId, coveringEmployeeProfileId: null, note: "Family dinner." },
    });
    await prisma.openShiftClaim.create({ data: { shiftId: openShift.id, employeeProfileId: f.ben.profileId } });
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("merges both queues with names, labels, and kinds", async () => {
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await GET(new Request(`http://test/api/locations/${f.locationId}/approvals?status=pending`), {
      params: Promise.resolve({ locationId: f.locationId }),
    });
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.approvals).toHaveLength(2);
    const swap = json.data.approvals.find((a: { kind: string }) => a.kind === "swap");
    expect(swap.employeeName).toBe("Ana Diaz");
    expect(swap.detail).toContain("Wants to swap their");
    expect(swap.subDetail).toBe("Open to anyone qualified");
    expect(swap.note).toBe("Family dinner.");
    const claim = json.data.approvals.find((a: { kind: string }) => a.kind === "claim");
    expect(claim.employeeName).toBe("Ben Cho");
    expect(claim.detail).toContain("Dishwasher");
    expect(claim.subDetail).toBe("Awaiting your approval");
  });

  it("rejects employees", async () => {
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await GET(new Request(`http://test/api/locations/${f.locationId}/approvals`), {
      params: Promise.resolve({ locationId: f.locationId }),
    });
    expect(res.status).toBe(403);
  });
});
