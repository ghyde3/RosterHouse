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
import { getScheduleWeekData } from "@/lib/schedule-data";
import { addDaysISO, weekStartOf, type ISODate } from "@/lib/time";
import { POST as publishSchedule } from "@/app/api/schedules/[scheduleId]/publish/route";

const NY = "America/New_York";
let locationId: string;
let scheduleId: string;
let farWeek: ISODate;
let userIds: string[] = [];
const startedAt = new Date();

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

  // Build an isolated week 50 weeks out: 2 assigned draft shifts for 2
  // different seeded employees + 1 open shift.
  farWeek = addDaysISO(weekStartOf(new Date(), NY), 7 * 50);
  const position = await prisma.position.findFirstOrThrow({ where: { locationId } });
  const profiles = await prisma.employeeProfile.findMany({
    where: { locationId, status: "active" },
    take: 2,
  });
  expect(profiles).toHaveLength(2);
  userIds = profiles.map((p) => p.userId);

  const schedule = await prisma.schedule.create({
    data: { locationId, weekStartDate: new Date(farWeek) },
  });
  scheduleId = schedule.id;
  const day = (n: number) => addDaysISO(farWeek, n);
  await prisma.shift.createMany({
    data: [
      {
        scheduleId, locationId, positionId: position.id,
        employeeProfileId: profiles[0].id, date: new Date(day(0)),
        startsAt: new Date(`${day(0)}T11:00:00Z`), endsAt: new Date(`${day(0)}T19:00:00Z`),
      },
      {
        scheduleId, locationId, positionId: position.id,
        employeeProfileId: profiles[1].id, date: new Date(day(1)),
        startsAt: new Date(`${day(1)}T11:00:00Z`), endsAt: new Date(`${day(1)}T19:00:00Z`),
      },
      {
        scheduleId, locationId, positionId: position.id,
        employeeProfileId: null, date: new Date(day(2)),
        startsAt: new Date(`${day(2)}T11:00:00Z`), endsAt: new Date(`${day(2)}T19:00:00Z`),
      },
    ],
  });
});

afterAll(async () => {
  await prisma.schedule.delete({ where: { id: scheduleId } }); // cascades shifts
  await prisma.notification.deleteMany({
    where: { userId: { in: userIds }, type: "schedule_published", createdAt: { gte: startedAt } },
  });
  // The seeded org persists, so drop the audit rows this suite wrote.
  await prisma.auditLog.deleteMany({
    where: { entityId: scheduleId, action: "schedule.published" },
  });
});

describe("POST /api/schedules/[scheduleId]/publish", () => {
  it("flips this schedule only, notifies distinct assignees, returns the real count", async () => {
    const res = await publishSchedule(
      new Request(`http://test/api/schedules/${scheduleId}/publish`, { method: "POST" }),
      { params: Promise.resolve({ scheduleId }) },
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.count).toBe(2); // 2 distinct employees; the open shift notifies no one

    const schedule = await prisma.schedule.findUniqueOrThrow({ where: { id: scheduleId } });
    expect(schedule.status).toBe("published");
    expect(schedule.publishedAt).not.toBeNull();

    const shifts = await prisma.shift.findMany({ where: { scheduleId } });
    expect(shifts.every((s) => s.status === "published")).toBe(true);

    const rows = await prisma.notification.findMany({
      where: { userId: { in: userIds }, type: "schedule_published", createdAt: { gte: startedAt } },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe("New schedule published");
  });

  it("records a schedule.published audit entry with actor and week detail", async () => {
    const jamie = mockSession.current!.user;
    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { organizationId: jamie.organizationId, action: "schedule.published", entityId: scheduleId },
    });
    expect(entry.locationId).toBe(locationId);
    expect(entry.actorUserId).toBe(jamie.id);
    expect(entry.actorName).toBe(jamie.name);
    expect(entry.entityType).toBe("Schedule");
    expect(entry.detail).toEqual({ weekStartDate: farWeek, shiftCount: 3 });
  });

  it("immediately after publish there are no unpublished changes", async () => {
    const data = await getScheduleWeekData(locationId, farWeek);
    expect(data.schedule.status).toBe("published");
    expect(data.schedule.hasUnpublishedChanges).toBe(false);
  });

  it("editing a published shift flags unpublished changes", async () => {
    const shift = await prisma.shift.findFirstOrThrow({
      where: { scheduleId, employeeProfileId: { not: null } },
    });
    await prisma.shift.update({
      where: { id: shift.id },
      data: { notes: "Edited after publish" },
    });
    const data = await getScheduleWeekData(locationId, farWeek);
    expect(data.schedule.hasUnpublishedChanges).toBe(true);
  });

  it("404s for a schedule outside the manager's location", async () => {
    const res = await publishSchedule(
      new Request("http://test/api/schedules/nope/publish", { method: "POST" }),
      { params: Promise.resolve({ scheduleId: "nope" }) },
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe("That schedule no longer exists");
  });
});
