import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { getPositionsForSettings } from "@/lib/queries/positions";
import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";

let f: Fixture;

beforeAll(async () => {
  f = await createFixture();
});
afterAll(async () => {
  await destroyFixture(f);
});

describe("getPositionsForSettings", () => {
  it("splits active (sortOrder asc) from archived (name asc)", async () => {
    // Fixture actives: Server(0), Dishwasher(1).
    const zed = await prisma.position.create({
      data: { locationId: f.locationId, name: "Zeta", sortOrder: 5, archivedAt: new Date() },
    });
    const alp = await prisma.position.create({
      data: { locationId: f.locationId, name: "Alpha", sortOrder: 6, archivedAt: new Date() },
    });

    const { active, archived } = await getPositionsForSettings(f.locationId);

    expect(active.map((p) => p.name)).toEqual(["Server", "Dishwasher"]);
    expect(active.every((p) => p.archived === false)).toBe(true);
    expect(archived.map((p) => p.name)).toEqual(["Alpha", "Zeta"]); // name asc
    expect(archived.every((p) => p.archived === true)).toBe(true);

    await prisma.position.deleteMany({ where: { id: { in: [zed.id, alp.id] } } });
  });
});
