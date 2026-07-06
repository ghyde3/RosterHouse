// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { buildConflictContext } from "@/lib/conflict-context";
import { detectConflicts } from "@/lib/conflicts";
import { addDaysISO, localToUtc, weekStartOf } from "@/lib/time";
import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";

describe("approved time off produces a conflict", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("flags a shift assigned inside an approved time-off range", async () => {
    // Next week's Tue–Thu, approved.
    const thisWeek = weekStartOf(new Date(), f.timezone);
    const nextWeekStart = addDaysISO(thisWeek, 7);
    const offStart = addDaysISO(nextWeekStart, 1); // Tue
    const offEnd = addDaysISO(nextWeekStart, 3); // Thu
    await prisma.timeOffRequest.create({
      data: {
        employeeProfileId: f.ana.profileId,
        startDate: new Date(offStart),
        endDate: new Date(offEnd),
        reason: "vacation",
        status: "approved",
        decidedByUserId: f.managerUserId,
        decidedAt: new Date(),
      },
    });

    const ctx = await buildConflictContext(f.ana.profileId, nextWeekStart);
    const proposedDate = addDaysISO(nextWeekStart, 2); // Wed, inside the range
    const conflicts = detectConflicts(
      {
        employeeProfileId: f.ana.profileId,
        date: proposedDate,
        startsAt: localToUtc(proposedDate, { hour: 9, minute: 0 }, f.timezone),
        endsAt: localToUtc(proposedDate, { hour: 17, minute: 0 }, f.timezone),
      },
      ctx,
    );

    expect(
      conflicts.some((c) => c.kind === "outside_availability" && /approved time off/i.test(c.message)),
    ).toBe(true);
  });

  it("does not flag a shift outside the approved range", async () => {
    const thisWeek = weekStartOf(new Date(), f.timezone);
    const nextWeekStart = addDaysISO(thisWeek, 7);
    const ctx = await buildConflictContext(f.ana.profileId, nextWeekStart);
    const proposedDate = addDaysISO(nextWeekStart, 5); // Sat, outside Tue–Thu
    const conflicts = detectConflicts(
      {
        employeeProfileId: f.ana.profileId,
        date: proposedDate,
        startsAt: localToUtc(proposedDate, { hour: 9, minute: 0 }, f.timezone),
        endsAt: localToUtc(proposedDate, { hour: 17, minute: 0 }, f.timezone),
      },
      ctx,
    );
    expect(conflicts.some((c) => /approved time off/i.test(c.message))).toBe(false);
  });
});
