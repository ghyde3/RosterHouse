import "dotenv/config"; // defensive: @/lib/db builds the Prisma client from DATABASE_URL at import time
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { buildConflictContext } from "@/lib/conflict-context";
import { addDaysISO, weekStartOf, type ISODate } from "@/lib/time";

let mariaProfileId: string;
let locationId: string;
let timezone: string;
let farWeek: ISODate; // 3 weeks out — no seed data there, so this test owns it
let createdShiftId: string | null = null;
let createdTimeOffId: string | null = null;

beforeAll(async () => {
  const maria = await prisma.user.findUnique({ where: { email: "maria@harborvine.test" } });
  if (!maria) throw new Error("Seed data missing. Run: npx prisma db seed");
  const profile = await prisma.employeeProfile.findFirstOrThrow({
    where: { userId: maria.id },
    include: { location: true },
  });
  mariaProfileId = profile.id;
  locationId = profile.locationId;
  timezone = profile.location.timezone;
  farWeek = addDaysISO(weekStartOf(new Date(), timezone), 21);
});

afterAll(async () => {
  if (createdShiftId) await prisma.shift.delete({ where: { id: createdShiftId } });
  if (createdTimeOffId) await prisma.timeOffRequest.delete({ where: { id: createdTimeOffId } });
  await prisma.schedule.deleteMany({
    where: { locationId, weekStartDate: new Date(farWeek) },
  });
});

describe("buildConflictContext", () => {
  it("loads profile facts from the seed", async () => {
    const ctx = await buildConflictContext(mariaProfileId, farWeek);
    expect(ctx.employeeName).toBe("Maria Garcia");
    expect(ctx.timezone).toBe("America/New_York");
    expect(ctx.overtimeHoursPerWeek).toBe(40);
    expect(ctx.availability.length).toBeGreaterThan(0);
    for (const rule of ctx.availability) {
      expect(rule.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(rule.dayOfWeek).toBeLessThanOrEqual(6);
    }
  });

  it("scopes shifts and time off to the requested week", async () => {
    // Create a shift and an approved time off in the far week, then verify
    // they appear there and NOT in the current week's context.
    const position = await prisma.position.findFirstOrThrow({ where: { locationId } });
    const schedule = await prisma.schedule.upsert({
      where: { locationId_weekStartDate: { locationId, weekStartDate: new Date(farWeek) } },
      create: { locationId, weekStartDate: new Date(farWeek) },
      update: {},
    });
    const shiftDate = addDaysISO(farWeek, 2);
    const shift = await prisma.shift.create({
      data: {
        scheduleId: schedule.id,
        locationId,
        positionId: position.id,
        employeeProfileId: mariaProfileId,
        date: new Date(shiftDate),
        startsAt: new Date(`${shiftDate}T15:00:00Z`),
        endsAt: new Date(`${shiftDate}T23:00:00Z`),
      },
    });
    createdShiftId = shift.id;
    const timeOff = await prisma.timeOffRequest.create({
      data: {
        employeeProfileId: mariaProfileId,
        startDate: new Date(addDaysISO(farWeek, 4)),
        endDate: new Date(addDaysISO(farWeek, 5)),
        reason: "vacation",
        status: "approved",
      },
    });
    createdTimeOffId = timeOff.id;

    const farCtx = await buildConflictContext(mariaProfileId, farWeek);
    expect(farCtx.employeeShifts.map((s) => s.id)).toContain(shift.id);
    expect(farCtx.employeeShifts.find((s) => s.id === shift.id)?.positionName).toBe(position.name);
    expect(farCtx.approvedTimeOff).toContainEqual({
      startDate: addDaysISO(farWeek, 4),
      endDate: addDaysISO(farWeek, 5),
    });

    const currentCtx = await buildConflictContext(mariaProfileId, weekStartOf(new Date(), timezone));
    expect(currentCtx.employeeShifts.map((s) => s.id)).not.toContain(shift.id);
    expect(currentCtx.approvedTimeOff).not.toContainEqual({
      startDate: addDaysISO(farWeek, 4),
      endDate: addDaysISO(farWeek, 5),
    });
  });
});
