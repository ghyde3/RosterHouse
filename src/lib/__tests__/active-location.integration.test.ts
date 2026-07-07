import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// getManagerLocation reads the switcher cookie through next/headers; give the
// suite a controllable store (real requests get the real one).
const cookieStore = vi.hoisted(() => ({ value: null as string | null, throws: false }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => {
    if (cookieStore.throws) throw new Error("outside request scope");
    return {
      get: (name: string) =>
        name === "rh-active-location" && cookieStore.value !== null
          ? { name, value: cookieStore.value }
          : undefined,
    };
  }),
}));

import { prisma } from "@/lib/db";
import { getManagerLocation, hashPassword } from "@/lib/authz";

const suffix = `active-loc-${Date.now()}`;

let orgId: string;
let otherOrgId: string;
let managerId: string;
let firstLocationId: string;
let secondLocationId: string;
let otherOrgLocationId: string;

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `Org ${suffix}` } });
  const otherOrg = await prisma.organization.create({ data: { name: `Other org ${suffix}` } });
  orgId = org.id;
  otherOrgId = otherOrg.id;

  const first = await prisma.location.create({
    data: { organizationId: org.id, name: "First", timezone: "America/New_York" },
  });
  // Explicitly later createdAt so "oldest" is deterministic.
  const second = await prisma.location.create({
    data: {
      organizationId: org.id,
      name: "Second",
      timezone: "America/Chicago",
      createdAt: new Date(first.createdAt.getTime() + 60_000),
    },
  });
  const otherLoc = await prisma.location.create({
    data: { organizationId: otherOrg.id, name: "Elsewhere", timezone: "America/Denver" },
  });
  firstLocationId = first.id;
  secondLocationId = second.id;
  otherOrgLocationId = otherLoc.id;

  const manager = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: "Switcher Manager",
      email: `manager-${suffix}@test.local`,
      passwordHash: await hashPassword("rosterhouse1"),
      role: "manager",
    },
  });
  managerId = manager.id;
});

afterAll(async () => {
  cookieStore.value = null;
  cookieStore.throws = false;
  await prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
});

describe("getManagerLocation with the active-location cookie", () => {
  it("returns the oldest location when no cookie is set", async () => {
    cookieStore.value = null;
    const location = await getManagerLocation(managerId);
    expect(location.id).toBe(firstLocationId);
  });

  it("returns the cookie's location when it belongs to the manager's org", async () => {
    cookieStore.value = secondLocationId;
    const location = await getManagerLocation(managerId);
    expect(location.id).toBe(secondLocationId);
  });

  it("ignores a cookie pointing at another org's location", async () => {
    cookieStore.value = otherOrgLocationId;
    const location = await getManagerLocation(managerId);
    expect(location.id).toBe(firstLocationId);
  });

  it("ignores a cookie pointing at a deleted location", async () => {
    cookieStore.value = "nonexistent-location-id";
    const location = await getManagerLocation(managerId);
    expect(location.id).toBe(firstLocationId);
  });

  it("falls back to the oldest location when cookies() throws (no request scope)", async () => {
    cookieStore.throws = true;
    const location = await getManagerLocation(managerId);
    expect(location.id).toBe(firstLocationId);
    cookieStore.throws = false;
  });
});
