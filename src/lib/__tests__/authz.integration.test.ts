import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  assertLocationMember,
  authenticateUser,
  getEmployeeProfile,
  getManagerLocation,
  hashPassword,
} from "@/lib/authz";

const suffix = `authz-${Date.now()}`;
const MANAGER_EMAIL = `manager-${suffix}@test.local`;
const EMPLOYEE_PHONE = `+1999${String(Date.now()).slice(-7)}`;

let orgAId: string;
let orgBId: string;
let locAId: string;
let locBId: string;
let managerAId: string;
let employeeAId: string;

beforeAll(async () => {
  const orgA = await prisma.organization.create({ data: { name: `Test Org A ${suffix}` } });
  const orgB = await prisma.organization.create({ data: { name: `Test Org B ${suffix}` } });
  orgAId = orgA.id;
  orgBId = orgB.id;

  const locA = await prisma.location.create({
    data: { organizationId: orgA.id, name: "A Downtown", timezone: "America/New_York" },
  });
  const locB = await prisma.location.create({
    data: { organizationId: orgB.id, name: "B Uptown", timezone: "America/Chicago" },
  });
  locAId = locA.id;
  locBId = locB.id;

  const passwordHash = await hashPassword("rosterhouse1");
  const managerA = await prisma.user.create({
    data: { organizationId: orgA.id, name: "Manager A", email: MANAGER_EMAIL, passwordHash, role: "manager" },
  });
  const employeeA = await prisma.user.create({
    data: { organizationId: orgA.id, name: "Employee A", phone: EMPLOYEE_PHONE, passwordHash, role: "employee" },
  });
  managerAId = managerA.id;
  employeeAId = employeeA.id;

  const positionA = await prisma.position.create({ data: { locationId: locA.id, name: "Server" } });
  await prisma.employeeProfile.create({
    data: { userId: employeeA.id, locationId: locA.id, primaryPositionId: positionA.id, status: "active" },
  });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } }); // cascades
  await prisma.$disconnect();
});

describe("getManagerLocation", () => {
  it("returns the org's sole location for a manager", async () => {
    const location = await getManagerLocation(managerAId);
    expect(location.id).toBe(locAId);
    expect(location.timezone).toBe("America/New_York");
  });
});

describe("getEmployeeProfile", () => {
  it("returns the profile with location and primary position", async () => {
    const profile = await getEmployeeProfile(employeeAId);
    expect(profile.location.id).toBe(locAId);
    expect(profile.primaryPosition?.name).toBe("Server");
  });

  it("throws a 404 ApiError for a user with no profile", async () => {
    await expect(getEmployeeProfile(managerAId)).rejects.toMatchObject({ status: 404, code: "no_profile" });
  });
});

describe("assertLocationMember", () => {
  it("resolves for a manager of the location's org", async () => {
    await expect(assertLocationMember(managerAId, locAId)).resolves.toBeUndefined();
  });

  it("resolves for an employee with a profile at the location", async () => {
    await expect(assertLocationMember(employeeAId, locAId)).resolves.toBeUndefined();
  });

  it("throws 403 for a manager of a different org", async () => {
    await expect(assertLocationMember(managerAId, locBId)).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });

  it("throws 403 for an employee with no profile at the location", async () => {
    await expect(assertLocationMember(employeeAId, locBId)).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });
});

describe("authenticateUser", () => {
  it("authenticates by email and password", async () => {
    const user = await authenticateUser(MANAGER_EMAIL, "rosterhouse1");
    expect(user?.id).toBe(managerAId);
  });

  it("authenticates by phone in any common format", async () => {
    const pretty = `(${EMPLOYEE_PHONE.slice(2, 5)}) ${EMPLOYEE_PHONE.slice(5, 8)}-${EMPLOYEE_PHONE.slice(8)}`;
    const user = await authenticateUser(pretty, "rosterhouse1");
    expect(user?.id).toBe(employeeAId);
  });

  it("returns null for a wrong password", async () => {
    await expect(authenticateUser(MANAGER_EMAIL, "wrong-password")).resolves.toBeNull();
  });

  it("returns null for an unknown identifier", async () => {
    await expect(authenticateUser("nobody@test.local", "rosterhouse1")).resolves.toBeNull();
  });
});
