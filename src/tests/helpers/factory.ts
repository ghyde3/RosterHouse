import { prisma } from "@/lib/db";
import { localToUtc, weekStartOf } from "@/lib/time";
import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import type { Shift } from "@/generated/prisma/client";

export type TestEmployee = { userId: string; profileId: string; name: string };

export type Fixture = {
  orgId: string;
  locationId: string;
  timezone: string;
  managerUserId: string;
  managerName: string;
  positionIds: { server: string; dishwasher: string };
  ana: TestEmployee; // Server
  ben: TestEmployee; // Server + Dishwasher
  cal: TestEmployee; // Server
};

let seq = 0;
function uniq(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${seq}`;
}

export async function createFixture(): Promise<Fixture> {
  const timezone = "America/New_York";
  const org = await prisma.organization.create({ data: { name: uniq("Test org") } });
  const location = await prisma.location.create({
    data: {
      organizationId: org.id,
      name: "Test location",
      timezone,
      latitude: 40.7128,
      longitude: -74.006,
      geofenceRadiusM: 150,
      overtimeHoursPerWeek: 40,
    },
  });
  const server = await prisma.position.create({
    data: { locationId: location.id, name: "Server", sortOrder: 0 },
  });
  const dishwasher = await prisma.position.create({
    data: { locationId: location.id, name: "Dishwasher", sortOrder: 1 },
  });
  const manager = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: "Test Manager",
      email: `${uniq("mgr")}@example.test`,
      passwordHash: "test-only-not-a-real-hash",
      role: "manager",
    },
  });

  async function employee(name: string, positionIds: string[]): Promise<TestEmployee> {
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        name,
        email: `${uniq("emp")}@example.test`,
        passwordHash: "test-only-not-a-real-hash",
        role: "employee",
      },
    });
    const profile = await prisma.employeeProfile.create({
      data: {
        userId: user.id,
        locationId: location.id,
        primaryPositionId: positionIds[0],
        status: "active",
        positions: { create: positionIds.map((positionId) => ({ positionId })) },
      },
    });
    return { userId: user.id, profileId: profile.id, name };
  }

  const ana = await employee("Ana Diaz", [server.id]);
  const ben = await employee("Ben Cho", [server.id, dishwasher.id]);
  const cal = await employee("Cal Ito", [server.id]);

  return {
    orgId: org.id,
    locationId: location.id,
    timezone,
    managerUserId: manager.id,
    managerName: "Test Manager",
    positionIds: { server: server.id, dishwasher: dishwasher.id },
    ana,
    ben,
    cal,
  };
}

export async function destroyFixture(f: Fixture): Promise<void> {
  // Organization delete cascades to locations, users, profiles, schedules,
  // shifts, requests, claims, clock entries, and notifications.
  await prisma.organization.delete({ where: { id: f.orgId } });
}

export function isoDateFromNow(days: number, timezone: string): string {
  return format(addDays(TZDate.tz(timezone), days), "yyyy-MM-dd");
}

async function upsertSchedule(f: Fixture, startsAt: Date, scheduleStatus: "draft" | "published") {
  const weekStart = weekStartOf(startsAt, f.timezone);
  return prisma.schedule.upsert({
    where: { locationId_weekStartDate: { locationId: f.locationId, weekStartDate: new Date(weekStart) } },
    create: { locationId: f.locationId, weekStartDate: new Date(weekStart), status: scheduleStatus },
    update: {},
  });
}

export async function createShift(
  f: Fixture,
  opts: {
    positionId: string;
    employeeProfileId: string | null;
    daysFromNow: number;
    startHour: number; // 0-23, location-local
    endHour: number; // 0-23, location-local, same day
    status?: "draft" | "published";
    scheduleStatus?: "draft" | "published";
  },
): Promise<Shift> {
  const date = isoDateFromNow(opts.daysFromNow, f.timezone);
  const startsAt = localToUtc(date, { hour: opts.startHour, minute: 0 }, f.timezone);
  const endsAt = localToUtc(date, { hour: opts.endHour, minute: 0 }, f.timezone);
  const schedule = await upsertSchedule(f, startsAt, opts.scheduleStatus ?? "published");
  return prisma.shift.create({
    data: {
      scheduleId: schedule.id,
      locationId: f.locationId,
      positionId: opts.positionId,
      employeeProfileId: opts.employeeProfileId,
      date: new Date(date),
      startsAt,
      endsAt,
      status: opts.status ?? "published",
    },
  });
}

export async function createShiftAt(
  f: Fixture,
  opts: {
    positionId: string;
    employeeProfileId: string | null;
    startsAt: Date;
    endsAt: Date;
    status?: "draft" | "published";
  },
): Promise<Shift> {
  const date = format(new TZDate(opts.startsAt, f.timezone), "yyyy-MM-dd");
  const schedule = await upsertSchedule(f, opts.startsAt, "published");
  return prisma.shift.create({
    data: {
      scheduleId: schedule.id,
      locationId: f.locationId,
      positionId: opts.positionId,
      employeeProfileId: opts.employeeProfileId,
      date: new Date(date),
      startsAt: opts.startsAt,
      endsAt: opts.endsAt,
      status: opts.status ?? "published",
    },
  });
}
