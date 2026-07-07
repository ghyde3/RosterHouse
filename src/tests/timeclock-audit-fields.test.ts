// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";

describe("TimeClockEntry audit fields", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("defaults the audit fields to null and can persist a stamp", async () => {
    const created = await prisma.timeClockEntry.create({
      data: { employeeProfileId: f.ana.profileId, locationId: f.locationId, clockInAt: new Date() },
    });
    expect(created.editedByUserId).toBeNull();
    expect(created.editedAt).toBeNull();

    const stamp = new Date();
    const updated = await prisma.timeClockEntry.update({
      where: { id: created.id },
      data: { editedByUserId: f.managerUserId, editedAt: stamp },
    });
    expect(updated.editedByUserId).toBe(f.managerUserId);
    expect(updated.editedAt?.getTime()).toBe(stamp.getTime());
  });
});
