import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  createTestEmployee,
  createTestOrg,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { getLocationAvailability } from "./availability";

const WEEK = "2026-07-06"; // Monday

describe("getLocationAvailability", () => {
  let t: TestOrg;
  let maria: { userId: string; profileId: string };

  beforeAll(async () => {
    t = await createTestOrg();
    maria = await createTestEmployee(t, "Maria Test");
    await createTestEmployee(t, "Norule Test"); // no rules → all-day defaults
    const inactive = await createTestEmployee(t, "Inactive Test");
    await prisma.employeeProfile.update({
      where: { id: inactive.profileId },
      data: { status: "inactive" },
    });

    // Maria: Mon 9–5 window, Tue unavailable; other days default (no rows).
    await prisma.availabilityRule.createMany({
      data: [
        { employeeProfileId: maria.profileId, dayOfWeek: 0, isAvailable: true, startTime: "09:00", endTime: "17:00" },
        { employeeProfileId: maria.profileId, dayOfWeek: 1, isAvailable: false, startTime: null, endTime: null },
      ],
    });
    // Approved time off Wed–Thu of the displayed week; a denied one is ignored.
    await prisma.timeOffRequest.createMany({
      data: [
        {
          employeeProfileId: maria.profileId,
          startDate: new Date("2026-07-08T00:00:00.000Z"),
          endDate: new Date("2026-07-09T00:00:00.000Z"),
          reason: "vacation",
          status: "approved",
        },
        {
          employeeProfileId: maria.profileId,
          startDate: new Date("2026-07-10T00:00:00.000Z"),
          endDate: new Date("2026-07-10T00:00:00.000Z"),
          reason: "personal",
          status: "denied",
        },
      ],
    });
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("returns all active employees with per-day windows and time-off overlay", async () => {
    const data = await getLocationAvailability(t.locationId, WEEK);
    expect(data.weekStart).toBe(WEEK);
    expect(data.employees.map((e) => e.name)).toEqual(["Maria Test", "Norule Test"]); // sorted; inactive excluded

    const mariaDays = data.employees[0].days;
    expect(mariaDays).toHaveLength(7);
    expect(mariaDays[0]).toEqual({
      dayOfWeek: 0,
      date: "2026-07-06",
      isAvailable: true,
      startTime: "09:00",
      endTime: "17:00",
      timeOff: false,
    });
    expect(mariaDays[1].isAvailable).toBe(false);
    expect(mariaDays[2].timeOff).toBe(true); // Wed
    expect(mariaDays[3].timeOff).toBe(true); // Thu
    expect(mariaDays[4].timeOff).toBe(false); // Fri — denied request ignored

    const noruleDays = data.employees[1].days;
    expect(noruleDays.every((d) => d.isAvailable && d.startTime === null)).toBe(true);
  });
});
