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
import { listMyRequests } from "@/lib/requests";
import { getEmployeeShiftDetail } from "@/lib/queries/employee";
import { createFixture, createShift, destroyFixture, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";
import type { Shift } from "@/generated/prisma/client";

describe("drop requests in approvals, my requests, and shift detail", () => {
  let f: Fixture;
  let myShift: Shift;
  beforeAll(async () => {
    f = await createFixture();
    myShift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 4,
      startHour: 16,
      endHour: 22,
    });
    // Ben works the same service date but does NOT overlap Ana → still a shift-mate.
    await createShift(f, {
      positionId: f.positionIds.dishwasher,
      employeeProfileId: f.ben.profileId,
      daysFromNow: 4,
      startHour: 9,
      endHour: 15,
    });
    // Cal's shift is another day → not a shift-mate.
    await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.cal.profileId,
      daysFromNow: 5,
      startHour: 9,
      endHour: 17,
    });
    await prisma.dropRequest.create({
      data: { shiftId: myShift.id, requestingEmployeeProfileId: f.ana.profileId, note: "Out of town." },
    });
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("includes pending drop requests in the manager approvals payload", async () => {
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await GET(new Request(`http://test/api/locations/${f.locationId}/approvals?status=pending`), {
      params: Promise.resolve({ locationId: f.locationId }),
    });
    const json = await res.json();
    expect(json.ok).toBe(true);
    const drop = json.data.approvals.find((a: { kind: string }) => a.kind === "drop");
    expect(drop).toBeDefined();
    expect(drop.employeeName).toBe("Ana Diaz");
    expect(drop.detail).toContain("Wants to drop their");
    expect(drop.detail).toContain("Server shift");
    expect(drop.note).toBe("Out of town.");
  });

  it("includes drop requests in the employee's request list", async () => {
    const items = await listMyRequests(f.ana.profileId);
    const drop = items.find((i) => i.kind === "drop");
    expect(drop).toBeDefined();
    expect(drop!.label).toContain("Drop ·");
    expect(drop!.label).toContain("Server");
    expect(drop!.status).toBe("pending");
    expect(drop!.detail).toContain("–");
  });

  it("lists same-day shift-mates with time ranges sorted by start, and flags the pending drop", async () => {
    const viewer = { profileId: f.ana.profileId, locationId: f.locationId, timezone: f.timezone };
    const detail = await getEmployeeShiftDetail(viewer, myShift.id);
    expect(detail).not.toBeNull();
    expect(detail!.hasPendingDrop).toBe(true);
    expect(detail!.shiftMates).toEqual([
      expect.objectContaining({
        name: "Ben Cho",
        positionName: "Dishwasher",
        timeRange: "9:00 AM – 3:00 PM",
      }),
    ]);
  });

  it("does not flag a pending drop for another viewer's context", async () => {
    // Ben viewing his own shift that day: no drop pending, and Ana appears as his shift-mate.
    const bensShift = await prisma.shift.findFirstOrThrow({
      where: { employeeProfileId: f.ben.profileId, date: myShift.date },
    });
    const viewer = { profileId: f.ben.profileId, locationId: f.locationId, timezone: f.timezone };
    const detail = await getEmployeeShiftDetail(viewer, bensShift.id);
    expect(detail!.hasPendingDrop).toBe(false);
    expect(detail!.shiftMates.map((m) => m.name)).toEqual(["Ana Diaz"]);
  });
});
