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
    // One-off exceptions: Sat (default all-day) blocked; Sun gets a window.
    await prisma.availabilityException.createMany({
      data: [
        {
          employeeProfileId: maria.profileId,
          date: new Date("2026-07-11T00:00:00.000Z"),
          isAvailable: false,
          note: "Wedding",
        },
        {
          employeeProfileId: maria.profileId,
          date: new Date("2026-07-12T00:00:00.000Z"),
          isAvailable: true,
          startTime: "08:00",
          endTime: "20:00",
        },
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
      exception: false,
    });
    expect(mariaDays[1].isAvailable).toBe(false);
    expect(mariaDays[2].timeOff).toBe(true); // Wed
    expect(mariaDays[3].timeOff).toBe(true); // Thu
    expect(mariaDays[4].timeOff).toBe(false); // Fri — denied request ignored

    // Sat: unavailable exception overrides the all-day default.
    expect(mariaDays[5]).toEqual({
      dayOfWeek: 5,
      date: "2026-07-11",
      isAvailable: false,
      startTime: null,
      endTime: null,
      timeOff: false,
      exception: true,
    });
    // Sun: custom-hours exception carries the effective window.
    expect(mariaDays[6]).toEqual({
      dayOfWeek: 6,
      date: "2026-07-12",
      isAvailable: true,
      startTime: "08:00",
      endTime: "20:00",
      timeOff: false,
      exception: true,
    });

    const noruleDays = data.employees[1].days;
    expect(noruleDays.every((d) => d.isAvailable && d.startTime === null)).toBe(true);
    expect(noruleDays.every((d) => !d.exception)).toBe(true);
  });

  it("exposes primaryPositionId and orders by primary sortOrder then name", async () => {
    // Reassign primary positions so ordering is observable:
    //  - Maria → Server (sortOrder 1)
    //  - Norule → Line cook (sortOrder 0)  [default already, set explicitly]
    // Sorted result must be: Norule (Line cook, 0), then Maria (Server, 1).
    await prisma.employeeProfile.update({
      where: { id: maria.profileId },
      data: { primaryPositionId: t.positions.server },
    });
    const norule = await prisma.employeeProfile.findFirstOrThrow({
      where: { locationId: t.locationId, user: { name: "Norule Test" } },
    });
    await prisma.employeeProfile.update({
      where: { id: norule.id },
      data: { primaryPositionId: t.positions.lineCook },
    });

    const data = await getLocationAvailability(t.locationId, WEEK);
    expect(data.employees.map((e) => e.name)).toEqual(["Norule Test", "Maria Test"]);
    expect(data.employees.map((e) => e.primaryPositionId)).toEqual([
      t.positions.lineCook,
      t.positions.server,
    ]);
    // primaryPositionName still exposed alongside the id.
    expect(data.employees.map((e) => e.primaryPositionName)).toEqual([
      "Line cook",
      "Server",
    ]);
  });
});
