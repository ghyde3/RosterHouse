import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { getScheduleWeekData } from "@/lib/schedule-data";
import { createFixture, createShift, destroyFixture, isoDateFromNow, type Fixture } from "./helpers/factory";
import { weekStartOfISO } from "@/lib/time";

let f: Fixture;

beforeAll(async () => {
  f = await createFixture();
});
afterAll(async () => {
  await destroyFixture(f);
});

describe("getScheduleWeekData archive-awareness", () => {
  it("omits an archived position with NO shift this week from the grid rows", async () => {
    const lonely = await prisma.position.create({
      data: { locationId: f.locationId, name: "Lonely archived", sortOrder: 80, archivedAt: new Date() },
    });
    const weekStart = weekStartOfISO(isoDateFromNow(0, f.timezone));
    const data = await getScheduleWeekData(f.locationId, weekStart);
    expect(data.positions.some((p) => p.id === lonely.id)).toBe(false);
    // Active fixture positions still present.
    expect(data.positions.some((p) => p.id === f.positionIds.server)).toBe(true);
  });

  it("KEEPS an archived position that has a shift in the viewed week", async () => {
    const archivedWithShift = await prisma.position.create({
      data: { locationId: f.locationId, name: "Archived with shift", sortOrder: 81 },
    });
    const shift = await createShift(f, {
      positionId: archivedWithShift.id,
      employeeProfileId: null,
      daysFromNow: 0,
      startHour: 9,
      endHour: 17,
    });
    // Archive AFTER the shift exists — mirrors real archive-of-used-role.
    await prisma.position.update({ where: { id: archivedWithShift.id }, data: { archivedAt: new Date() } });

    const weekStart = weekStartOfISO(isoDateFromNow(0, f.timezone));
    const data = await getScheduleWeekData(f.locationId, weekStart);
    expect(data.positions.some((p) => p.id === archivedWithShift.id)).toBe(true);

    await prisma.shift.delete({ where: { id: shift.id } });
  });

  it("keeps grid rows ordered by sortOrder asc after the union", async () => {
    const data = await getScheduleWeekData(f.locationId, weekStartOfISO(isoDateFromNow(0, f.timezone)));
    const orders = data.positions
      .map((p) => p.id)
      .map((id) => data.positions.findIndex((q) => q.id === id));
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});
