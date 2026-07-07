// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getDashboardData } from "@/lib/dashboard-data";
import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";
import { weekStartOf, localToUtc } from "@/lib/time";

describe("getDashboardData actual labor cost", () => {
  let f: Fixture;
  let weekMonday: string;
  beforeAll(async () => {
    f = await createFixture();
    weekMonday = weekStartOf(new Date(), f.timezone);
    // A completed 4-hour entry this week for Ana at $20/h → $80 actual.
    await prisma.employeeProfile.update({
      where: { id: f.ana.profileId },
      data: { hourlyRate: 20 },
    });
    const inAt = localToUtc(weekMonday, { hour: 9, minute: 0 }, f.timezone);
    const outAt = localToUtc(weekMonday, { hour: 13, minute: 0 }, f.timezone);
    await prisma.timeClockEntry.create({
      data: {
        employeeProfileId: f.ana.profileId,
        locationId: f.locationId,
        clockInAt: inAt,
        clockOutAt: outAt,
      },
    });
    // An OPEN entry must not contribute to actual cost.
    await prisma.timeClockEntry.create({
      data: {
        employeeProfileId: f.ana.profileId,
        locationId: f.locationId,
        clockInAt: localToUtc(weekMonday, { hour: 14, minute: 0 }, f.timezone),
        clockOutAt: null,
      },
    });
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("sums completed entries × rate, ignoring open ones", async () => {
    const data = await getDashboardData(f.locationId, f.timezone);
    expect(data.actualLaborCost).toBe("$80");
  });
});
