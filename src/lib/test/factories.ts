// src/lib/test/factories.ts — throwaway DB fixtures for integration tests.
// Each test suite creates its own org and deletes it afterwards, so tests
// never depend on (or corrupt) the demo seed.
import { prisma } from "@/lib/db";

export type TestOrg = {
  organizationId: string;
  locationId: string;
  timezone: string;
  positions: { lineCook: string; server: string };
  managerUserId: string;
};

let seq = 0;
function uniq(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

export async function createTestOrg(): Promise<TestOrg> {
  const org = await prisma.organization.create({ data: { name: uniq("Test Org") } });
  const location = await prisma.location.create({
    data: {
      organizationId: org.id,
      name: "Test location",
      timezone: "America/New_York",
      address: "1 Test St",
      overtimeHoursPerWeek: 40,
    },
  });
  const lineCook = await prisma.position.create({
    data: { locationId: location.id, name: "Line cook", sortOrder: 0 },
  });
  const server = await prisma.position.create({
    data: { locationId: location.id, name: "Server", sortOrder: 1 },
  });
  const manager = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: "Test Manager",
      email: `${uniq("mgr")}@test.local`,
      passwordHash: "not-a-real-hash",
      role: "manager",
    },
  });
  return {
    organizationId: org.id,
    locationId: location.id,
    timezone: location.timezone,
    positions: { lineCook: lineCook.id, server: server.id },
    managerUserId: manager.id,
  };
}

export async function createTestEmployee(
  t: TestOrg,
  name: string
): Promise<{ userId: string; profileId: string }> {
  const user = await prisma.user.create({
    data: {
      organizationId: t.organizationId,
      name,
      email: `${uniq("emp")}@test.local`,
      passwordHash: "not-a-real-hash",
      role: "employee",
    },
  });
  const profile = await prisma.employeeProfile.create({
    data: {
      userId: user.id,
      locationId: t.locationId,
      status: "active",
      primaryPositionId: t.positions.lineCook,
    },
  });
  return { userId: user.id, profileId: profile.id };
}

export async function createTestSchedule(
  t: TestOrg,
  weekStart: string,
  status: "draft" | "published"
): Promise<string> {
  const schedule = await prisma.schedule.create({
    data: {
      locationId: t.locationId,
      weekStartDate: new Date(`${weekStart}T00:00:00.000Z`),
      status,
    },
  });
  return schedule.id;
}

export async function createTestShift(
  t: TestOrg,
  args: {
    scheduleId: string;
    positionId: string;
    employeeProfileId: string | null;
    date: string; // ISODate, location-local service date
    startsAt: string; // ISO UTC instant
    endsAt: string; // ISO UTC instant
    status: "draft" | "published";
    notes?: string;
  }
): Promise<string> {
  const shift = await prisma.shift.create({
    data: {
      scheduleId: args.scheduleId,
      locationId: t.locationId,
      positionId: args.positionId,
      employeeProfileId: args.employeeProfileId,
      date: new Date(`${args.date}T00:00:00.000Z`),
      startsAt: new Date(args.startsAt),
      endsAt: new Date(args.endsAt),
      status: args.status,
      notes: args.notes ?? null,
    },
  });
  return shift.id;
}

/** Cascades: org → users + locations → profiles, schedules, shifts, notifications, … */
export async function deleteTestOrg(organizationId: string): Promise<void> {
  await prisma.organization.delete({ where: { id: organizationId } });
}
