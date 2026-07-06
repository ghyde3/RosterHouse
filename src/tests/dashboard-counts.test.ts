// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { countClockedInNow, countPendingRequests } from "@/lib/requests";
import { createFixture, createShift, destroyFixture, isoDateFromNow, type Fixture } from "./helpers/factory";

describe("dashboard counters", () => {
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
      positionId: f.positionIds.server,
      employeeProfileId: null,
      daysFromNow: 5,
      startHour: 9,
      endHour: 17,
    });
    // One of each pending queue + one decided row that must NOT count.
    await prisma.timeOffRequest.create({
      data: {
        employeeProfileId: f.ana.profileId,
        startDate: new Date(isoDateFromNow(10, f.timezone)),
        endDate: new Date(isoDateFromNow(11, f.timezone)),
        reason: "vacation",
      },
    });
    await prisma.swapRequest.create({
      data: { shiftId: myShift.id, requestingEmployeeProfileId: f.ana.profileId, coveringEmployeeProfileId: null },
    });
    await prisma.openShiftClaim.create({ data: { shiftId: openShift.id, employeeProfileId: f.ben.profileId } });
    await prisma.openShiftClaim.create({
      data: { shiftId: openShift.id, employeeProfileId: f.cal.profileId, status: "denied", decidedAt: new Date() },
    });
    // One live clock entry, one completed.
    await prisma.timeClockEntry.create({
      data: { employeeProfileId: f.ana.profileId, locationId: f.locationId, clockInAt: new Date() },
    });
    await prisma.timeClockEntry.create({
      data: {
        employeeProfileId: f.ben.profileId,
        locationId: f.locationId,
        clockInAt: new Date(Date.now() - 8 * 3_600_000),
        clockOutAt: new Date(Date.now() - 3_600_000),
      },
    });
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("counts pending requests across all three queues", async () => {
    expect(await countPendingRequests(f.locationId)).toBe(3);
  });

  it("counts only currently clocked-in employees", async () => {
    expect(await countClockedInNow(f.locationId)).toBe(1);
  });
});
