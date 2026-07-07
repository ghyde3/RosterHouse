import "dotenv/config"; // defensive: @/lib/db builds the Prisma client from DATABASE_URL at import time
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mockSession = vi.hoisted(() => ({
  current: null as null | {
    user: { id: string; name: string; role: "manager" | "employee"; organizationId: string };
  },
}));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => mockSession.current),
}));

import { prisma } from "@/lib/db";
import { PATCH as patchLocation } from "@/app/api/locations/[locationId]/route";
import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";

let locationId: string;
let original: { name: string; timezone: string; overtimeHoursPerWeek: number | null; address: string | null };

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const jamie = await prisma.user.findUnique({ where: { email: "jamie@harborvine.test" } });
  if (!jamie) throw new Error("Seed data missing. Run: npx prisma db seed");
  mockSession.current = {
    user: { id: jamie.id, name: jamie.name, role: "manager", organizationId: jamie.organizationId },
  };
  const location = await prisma.location.findFirstOrThrow({
    where: { organizationId: jamie.organizationId },
  });
  locationId = location.id;
  original = {
    name: location.name,
    timezone: location.timezone,
    overtimeHoursPerWeek: location.overtimeHoursPerWeek,
    address: location.address,
  };
});

afterAll(async () => {
  // Restore the shared seed location so other suites see original config.
  await prisma.location.update({ where: { id: locationId }, data: original });
});

describe("PATCH /api/locations/[locationId]", () => {
  it("updates name, timezone, overtime, and address", async () => {
    const res = await patchLocation(
      jsonRequest(`http://test/api/locations/${locationId}`, {
        name: "Harbor & Vine — Downtown",
        timezone: "America/Los_Angeles",
        overtimeHoursPerWeek: 45,
        address: "500 Market St",
      }),
      { params: Promise.resolve({ locationId }) },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.location).toMatchObject({
      id: locationId,
      name: "Harbor & Vine — Downtown",
      timezone: "America/Los_Angeles",
      overtimeHoursPerWeek: 45,
      address: "500 Market St",
    });
    const row = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
    expect(row.timezone).toBe("America/Los_Angeles");
    expect(row.overtimeHoursPerWeek).toBe(45);
  });

  it("accepts a null overtimeHoursPerWeek (OT conflicts off)", async () => {
    const res = await patchLocation(
      jsonRequest(`http://test/api/locations/${locationId}`, {
        name: original.name,
        timezone: "America/New_York",
        overtimeHoursPerWeek: null,
        address: null,
      }),
      { params: Promise.resolve({ locationId }) },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.location.overtimeHoursPerWeek).toBeNull();
    expect(body.data.location.address).toBeNull();
  });

  it("rejects an invalid IANA timezone with 400", async () => {
    const res = await patchLocation(
      jsonRequest(`http://test/api/locations/${locationId}`, {
        name: original.name,
        timezone: "Mars/Olympus_Mons",
        overtimeHoursPerWeek: 40,
        address: null,
      }),
      { params: Promise.resolve({ locationId }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.message).toContain("valid time zone");
  });

  it("rejects an empty name with 400", async () => {
    const res = await patchLocation(
      jsonRequest(`http://test/api/locations/${locationId}`, {
        name: "   ",
        timezone: "America/New_York",
        overtimeHoursPerWeek: 40,
        address: null,
      }),
      { params: Promise.resolve({ locationId }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects a negative overtimeHoursPerWeek with 400", async () => {
    const res = await patchLocation(
      jsonRequest(`http://test/api/locations/${locationId}`, {
        name: original.name,
        timezone: "America/New_York",
        overtimeHoursPerWeek: -5,
        address: null,
      }),
      { params: Promise.resolve({ locationId }) },
    );
    expect(res.status).toBe(400);
  });

  it("401s when signed out", async () => {
    const saved = mockSession.current;
    mockSession.current = null;
    const res = await patchLocation(
      jsonRequest(`http://test/api/locations/${locationId}`, {
        name: original.name,
        timezone: "America/New_York",
        overtimeHoursPerWeek: 40,
        address: null,
      }),
      { params: Promise.resolve({ locationId }) },
    );
    expect(res.status).toBe(401);
    mockSession.current = saved;
  });

  it("403s when the manager doesn't own the target location", async () => {
    const orgB: Fixture = await createFixture();
    try {
      const res = await patchLocation(
        jsonRequest(`http://test/api/locations/${orgB.locationId}`, {
          name: "Hijack",
          timezone: "America/New_York",
          overtimeHoursPerWeek: 40,
          address: null,
        }),
        { params: Promise.resolve({ locationId: orgB.locationId }) },
      );
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("forbidden");
      // And the foreign location is untouched.
      const row = await prisma.location.findUniqueOrThrow({ where: { id: orgB.locationId } });
      expect(row.name).toBe("Test location");
    } finally {
      await destroyFixture(orgB);
    }
  });
});
