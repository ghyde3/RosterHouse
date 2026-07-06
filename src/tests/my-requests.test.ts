// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { listMyRequests, listMyUpcomingShifts } from "@/lib/requests";
import { createFixture, createShift, destroyFixture, type Fixture } from "./helpers/factory";

describe("my requests + upcoming shifts read models", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("merges my swap requests and claims, newest first, with labels", async () => {
    const myShift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 4,
      startHour: 16,
      endHour: 22,
    });
    const openShift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: null,
      daysFromNow: 5,
      startHour: 9,
      endHour: 17,
    });
    await prisma.swapRequest.create({
      data: {
        shiftId: myShift.id,
        requestingEmployeeProfileId: f.ana.profileId,
        coveringEmployeeProfileId: f.ben.profileId,
      },
    });
    await prisma.openShiftClaim.create({ data: { shiftId: openShift.id, employeeProfileId: f.ana.profileId } });

    const items = await listMyRequests(f.ana.profileId);
    expect(items).toHaveLength(2);
    const kinds = items.map((i) => i.kind).sort();
    expect(kinds).toEqual(["claim", "swap"]);
    const swap = items.find((i) => i.kind === "swap")!;
    expect(swap.label).toContain("Server");
    expect(swap.detail).toBe("Asked Ben Cho to cover");
    expect(swap.status).toBe("pending");
    const claim = items.find((i) => i.kind === "claim")!;
    expect(claim.detail).toContain("–");
  });

  it("lists upcoming published shifts with a pending-swap marker", async () => {
    const shifts = await listMyUpcomingShifts(f.ana.profileId);
    expect(shifts.length).toBeGreaterThanOrEqual(1);
    const withPending = shifts.find((s) => s.hasPendingSwap);
    expect(withPending?.positionName).toBe("Server");
  });
});
