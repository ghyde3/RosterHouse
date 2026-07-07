import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mockSession = vi.hoisted(() => ({
  current: null as null | {
    user: { id: string; name: string; role: "manager" | "employee"; organizationId: string };
  },
}));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => mockSession.current),
}));

// Route handlers set/read the switcher cookie through next/headers; the tests
// run outside a request scope, so provide a recording store.
const cookieJar = vi.hoisted(() => ({
  value: null as string | null,
  sets: [] as Array<{ name: string; value: string; options: Record<string, unknown> }>,
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "rh-active-location" && cookieJar.value !== null
        ? { name, value: cookieJar.value }
        : undefined,
    set: (name: string, value: string, options: Record<string, unknown>) => {
      cookieJar.sets.push({ name, value, options });
      cookieJar.value = value;
    },
  })),
}));

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/authz";
import { POST as createLocation } from "@/app/api/locations/route";
import { PUT as putActiveLocation } from "@/app/api/active-location/route";

const suffix = `loc-manage-${Date.now()}`;

let orgId: string;
let otherOrgId: string;
let homeLocationId: string;
let otherOrgLocationId: string;
let managerId: string;
let employeeId: string;

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function managerSession() {
  mockSession.current = {
    user: { id: managerId, name: "Manage Manager", role: "manager", organizationId: orgId },
  };
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `Org ${suffix}` } });
  const otherOrg = await prisma.organization.create({ data: { name: `Other ${suffix}` } });
  orgId = org.id;
  otherOrgId = otherOrg.id;

  const home = await prisma.location.create({
    data: { organizationId: org.id, name: "Home base", timezone: "America/New_York" },
  });
  homeLocationId = home.id;
  const otherLoc = await prisma.location.create({
    data: { organizationId: otherOrg.id, name: "Elsewhere", timezone: "America/Chicago" },
  });
  otherOrgLocationId = otherLoc.id;

  const passwordHash = await hashPassword("rosterhouse1");
  const manager = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: "Manage Manager",
      email: `manager-${suffix}@test.local`,
      passwordHash,
      role: "manager",
    },
  });
  managerId = manager.id;
  const employee = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: "Manage Employee",
      email: `employee-${suffix}@test.local`,
      passwordHash,
      role: "employee",
    },
  });
  employeeId = employee.id;
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
});

describe("POST /api/locations", () => {
  it("creates a location, switches to it, and writes an audit entry", async () => {
    managerSession();
    cookieJar.value = null;
    cookieJar.sets = [];

    const res = await createLocation(
      jsonRequest("http://test/api/locations", "POST", {
        name: "Uptown",
        timezone: "America/Chicago",
        address: "42 North Ave",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.location.name).toBe("Uptown");

    const row = await prisma.location.findUnique({ where: { id: body.data.location.id } });
    expect(row?.organizationId).toBe(orgId);
    expect(row?.timezone).toBe("America/Chicago");
    expect(row?.address).toBe("42 North Ave");

    // Switched the active-location cookie to the new location.
    expect(cookieJar.sets).toHaveLength(1);
    expect(cookieJar.sets[0]).toMatchObject({ name: "rh-active-location", value: row?.id });

    const audit = await prisma.auditLog.findFirst({
      where: { organizationId: orgId, action: "location.created", entityId: row?.id },
    });
    expect(audit?.actorUserId).toBe(managerId);
  });

  it("rejects an invalid timezone", async () => {
    managerSession();
    const res = await createLocation(
      jsonRequest("http://test/api/locations", "POST", { name: "Bad", timezone: "Mars/Olympus" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects employees", async () => {
    mockSession.current = {
      user: { id: employeeId, name: "Manage Employee", role: "employee", organizationId: orgId },
    };
    const res = await createLocation(
      jsonRequest("http://test/api/locations", "POST", { name: "Nope", timezone: "America/New_York" }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects signed-out requests", async () => {
    mockSession.current = null;
    const res = await createLocation(
      jsonRequest("http://test/api/locations", "POST", { name: "Nope", timezone: "America/New_York" }),
    );
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/active-location", () => {
  it("sets the cookie for a location in the manager's org", async () => {
    managerSession();
    cookieJar.value = null;
    cookieJar.sets = [];

    const res = await putActiveLocation(
      jsonRequest("http://test/api/active-location", "PUT", { locationId: homeLocationId }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.locationId).toBe(homeLocationId);
    expect(cookieJar.value).toBe(homeLocationId);
  });

  it("refuses another org's location", async () => {
    managerSession();
    cookieJar.value = null;
    cookieJar.sets = [];

    const res = await putActiveLocation(
      jsonRequest("http://test/api/active-location", "PUT", { locationId: otherOrgLocationId }),
    );
    expect(res.status).toBe(404);
    expect(cookieJar.sets).toHaveLength(0);
  });

  it("rejects employees", async () => {
    mockSession.current = {
      user: { id: employeeId, name: "Manage Employee", role: "employee", organizationId: orgId },
    };
    const res = await putActiveLocation(
      jsonRequest("http://test/api/active-location", "PUT", { locationId: homeLocationId }),
    );
    expect(res.status).toBe(403);
  });
});
