// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { listMyTimeOffRequests, listTimeOff } from "@/lib/requests";
import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";

describe("time-off balance read model (requestedHours + balanceHours)", () => {
  let f: Fixture;
  let vacationId: string;
  let sickId: string;
  let personalId: string;
  let noBucketsId: string;

  beforeAll(async () => {
    f = await createFixture();
    // Ana has tracked balances; Ben keeps the factory default NULL buckets.
    await prisma.employeeProfile.update({
      where: { id: f.ana.profileId },
      data: { vacationBalanceHours: 24, sickBalanceHours: 10 },
    });
    const vacation = await prisma.timeOffRequest.create({
      data: {
        employeeProfileId: f.ana.profileId,
        startDate: new Date("2026-08-03"), // Mon
        endDate: new Date("2026-08-05"), // Wed → 3 inclusive days
        reason: "vacation",
      },
    });
    const sick = await prisma.timeOffRequest.create({
      data: {
        employeeProfileId: f.ana.profileId,
        startDate: new Date("2026-08-10"),
        endDate: new Date("2026-08-10"), // single day
        reason: "sick",
      },
    });
    const personal = await prisma.timeOffRequest.create({
      data: {
        employeeProfileId: f.ana.profileId,
        startDate: new Date("2026-08-12"),
        endDate: new Date("2026-08-13"), // 2 inclusive days
        reason: "personal",
      },
    });
    const noBuckets = await prisma.timeOffRequest.create({
      data: {
        employeeProfileId: f.ben.profileId,
        startDate: new Date("2026-08-17"),
        endDate: new Date("2026-08-17"),
        reason: "vacation",
      },
    });
    vacationId = vacation.id;
    sickId = sick.id;
    personalId = personal.id;
    noBucketsId = noBuckets.id;
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("computes requestedHours from inclusive days and reads the matching bucket", async () => {
    const items = await listTimeOff(f.locationId, "pending");
    expect(items).toHaveLength(4);
    const byId = new Map(items.map((i) => [i.id, i]));

    const vacation = byId.get(vacationId)!;
    expect(vacation.requestedHours).toBe(24); // 3 days × 8
    expect(vacation.balanceHours).toBe(24);

    const sick = byId.get(sickId)!;
    expect(sick.requestedHours).toBe(8); // 1 day × 8
    expect(sick.balanceHours).toBe(10);

    const personal = byId.get(personalId)!;
    expect(personal.requestedHours).toBe(16); // 2 days × 8
    expect(personal.balanceHours).toBeNull(); // untracked reason
  });

  it("NULL balance buckets surface as balanceHours null", async () => {
    const items = await listMyTimeOffRequests(f.ben.profileId);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(noBucketsId);
    expect(items[0].requestedHours).toBe(8);
    expect(items[0].balanceHours).toBeNull();
  });
});
