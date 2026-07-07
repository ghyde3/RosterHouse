import "dotenv/config"; // defensive: @/lib/db builds the Prisma client from DATABASE_URL at import time
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { buildConflictContext } from "@/lib/conflict-context";
import { addDaysISO, localToUtc, weekStartOf, weekStartOfISO, type ISODate } from "@/lib/time";
import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";

let f: Fixture;
let weekStart: ISODate; // 4 weeks out — the throwaway org owns all data there

/** One published 3–11 PM shift for Ana on `date`; returns the shift id. */
async function shiftOn(date: ISODate): Promise<string> {
  const schedule = await prisma.schedule.upsert({
    where: {
      locationId_weekStartDate: {
        locationId: f.locationId,
        weekStartDate: new Date(weekStartOfISO(date)),
      },
    },
    create: { locationId: f.locationId, weekStartDate: new Date(weekStartOfISO(date)) },
    update: {},
  });
  const shift = await prisma.shift.create({
    data: {
      scheduleId: schedule.id,
      locationId: f.locationId,
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      date: new Date(date),
      startsAt: localToUtc(date, { hour: 15, minute: 0 }, f.timezone),
      endsAt: localToUtc(date, { hour: 23, minute: 0 }, f.timezone),
      status: "published",
    },
  });
  return shift.id;
}

let inWeekId: string;
let dayBeforeId: string; // weekStart - 1
let sixBackId: string; // weekStart - 6
let sevenBackId: string; // weekStart - 7 (outside even the widest window here)

beforeAll(async () => {
  f = await createFixture();
  await prisma.location.update({
    where: { id: f.locationId },
    data: { minRestHours: 10, maxConsecutiveDays: 6 },
  });
  weekStart = addDaysISO(weekStartOf(new Date(), f.timezone), 28);
  inWeekId = await shiftOn(addDaysISO(weekStart, 1));
  dayBeforeId = await shiftOn(addDaysISO(weekStart, -1));
  sixBackId = await shiftOn(addDaysISO(weekStart, -6));
  sevenBackId = await shiftOn(addDaysISO(weekStart, -7));
});

afterAll(async () => {
  await destroyFixture(f); // cascades schedules + shifts
});

describe("buildConflictContext lookback window", () => {
  it("loads the compliance settings and max(2, maxConsecutiveDays) prior days into priorShifts", async () => {
    const ctx = await buildConflictContext(f.ana.profileId, weekStart);
    expect(ctx.minRestHours).toBe(10);
    expect(ctx.maxConsecutiveDays).toBe(6);

    // In-week shifts stay in employeeShifts (overtime/double-booking scope)…
    expect(ctx.employeeShifts.map((s) => s.id)).toEqual([inWeekId]);

    // …and the 6-day lookback (maxConsecutiveDays) lands in priorShifts only.
    const priorIds = (ctx.priorShifts ?? []).map((s) => s.id);
    expect(priorIds).toContain(dayBeforeId);
    expect(priorIds).toContain(sixBackId);
    expect(priorIds).not.toContain(sevenBackId);
    expect(priorIds).not.toContain(inWeekId);
  });

  it("keeps a 2-day floor for rest checks when maxConsecutiveDays is off", async () => {
    await prisma.location.update({
      where: { id: f.locationId },
      data: { maxConsecutiveDays: null },
    });
    const ctx = await buildConflictContext(f.ana.profileId, weekStart);
    expect(ctx.maxConsecutiveDays).toBeNull();

    const priorIds = (ctx.priorShifts ?? []).map((s) => s.id);
    expect(priorIds).toContain(dayBeforeId); // weekStart - 1: inside the floor
    expect(priorIds).not.toContain(sixBackId); // weekStart - 6: outside it
  });
});
