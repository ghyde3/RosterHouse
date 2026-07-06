// @vitest-environment node
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createFixture, createShift, destroyFixture } from "./helpers/factory";

describe("integration-test factory", () => {
  it("creates and destroys an isolated org tree", async () => {
    const f = await createFixture();
    const shift = await createShift(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      daysFromNow: 3,
      startHour: 16,
      endHour: 22,
    });
    expect(shift.status).toBe("published");
    expect(await prisma.employeeProfile.count({ where: { locationId: f.locationId } })).toBe(3);
    await destroyFixture(f);
    expect(await prisma.shift.findUnique({ where: { id: shift.id } })).toBeNull();
  });
});
