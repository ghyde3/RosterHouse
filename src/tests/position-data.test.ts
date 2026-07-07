import "dotenv/config"; // @/lib/db builds the Prisma client from DATABASE_URL at import time
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { assertNameAvailable, nextSortOrder } from "@/lib/position-data";
import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";

let f: Fixture;

beforeAll(async () => {
  f = await createFixture();
});
afterAll(async () => {
  await destroyFixture(f);
});

describe("assertNameAvailable", () => {
  it("resolves for a brand-new name", async () => {
    await expect(assertNameAvailable(f.locationId, "Bartender")).resolves.toBeUndefined();
  });

  it("throws 409 name_taken on a case-insensitive collision with an active position", async () => {
    // Fixture seeds an active "Server" position.
    await expect(assertNameAvailable(f.locationId, "server")).rejects.toMatchObject({
      status: 409,
      code: "name_taken",
    });
    await expect(assertNameAvailable(f.locationId, "  SERVER  ")).rejects.toBeInstanceOf(ApiError);
  });

  it("ignores the excluded id (rename to same name is allowed)", async () => {
    await expect(
      assertNameAvailable(f.locationId, "Server", { excludeId: f.positionIds.server }),
    ).resolves.toBeUndefined();
  });

  it("ignores archived positions when checking availability", async () => {
    const archived = await prisma.position.create({
      data: { locationId: f.locationId, name: "Barback", sortOrder: 99, archivedAt: new Date() },
    });
    // Same name as an archived role is allowed because archive frees the name for new scheduling.
    await expect(assertNameAvailable(f.locationId, "barback")).resolves.toBeUndefined();
    await prisma.position.delete({ where: { id: archived.id } });
  });
});

describe("nextSortOrder", () => {
  it("returns max active sortOrder + 1", async () => {
    // Fixture: Server sortOrder 0, Dishwasher sortOrder 1 → next is 2.
    await expect(nextSortOrder(f.locationId)).resolves.toBe(2);
  });

  it("returns 0 when the location has no active positions", async () => {
    const org = await prisma.organization.create({ data: { name: "Empty org for sortorder" } });
    const loc = await prisma.location.create({
      data: { organizationId: org.id, name: "Empty loc", timezone: "America/New_York" },
    });
    await expect(nextSortOrder(loc.id)).resolves.toBe(0);
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
