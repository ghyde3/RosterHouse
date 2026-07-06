import "dotenv/config"; // defensive: @/lib/db builds the Prisma client from DATABASE_URL at import time
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Route handlers read the session via auth() from @/lib/auth; mock the whole
// module so tests control who is signed in without running Auth.js.
const mockSession = vi.hoisted(() => ({
  current: null as null | {
    user: { id: string; name: string; role: "manager" | "employee"; organizationId: string };
  },
}));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => mockSession.current),
}));

import { prisma } from "@/lib/db";
import { addDaysISO, formatTime, toISODate, weekStartOf, weekStartOfISO } from "@/lib/time";
import { GET as getSchedule } from "@/app/api/locations/[locationId]/schedule/route";
import { GET as getShiftCounts } from "@/app/api/locations/[locationId]/shifts/route";
import { POST as createShift } from "@/app/api/shifts/route";
import { DELETE as deleteShift, PATCH as patchShift } from "@/app/api/shifts/[shiftId]/route";
import { POST as validateShift } from "@/app/api/shifts/validate/route";

const NY = "America/New_York";
let locationId: string;
let timezone: string;
const createdShiftIds: string[] = [];
const createdWeekStarts: string[] = [];

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
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
  timezone = location.timezone;
});

afterAll(async () => {
  await prisma.shift.deleteMany({ where: { id: { in: createdShiftIds } } });
  await prisma.schedule.deleteMany({
    where: { locationId, weekStartDate: { in: createdWeekStarts.map((w) => new Date(w)) } },
  });
});

describe("GET /api/locations/[locationId]/schedule", () => {
  it("returns 401 when signed out", async () => {
    const saved = mockSession.current;
    mockSession.current = null;
    const res = await getSchedule(
      new Request(`http://test/api/locations/${locationId}/schedule?weekStart=2026-07-06`),
      { params: Promise.resolve({ locationId }) },
    );
    expect(res.status).toBe(401);
    expect((await res.json()).ok).toBe(false);
    mockSession.current = saved;
  });

  it("rejects a weekStart that is not a Monday", async () => {
    const res = await getSchedule(
      new Request(`http://test/api/locations/${locationId}/schedule?weekStart=2026-07-08`),
      { params: Promise.resolve({ locationId }) },
    );
    expect(res.status).toBe(400);
  });

  it("lazily creates a draft schedule for an untouched week", async () => {
    const farWeek = addDaysISO(weekStartOf(new Date(), NY), 7 * 40);
    createdWeekStarts.push(farWeek);
    const res = await getSchedule(
      new Request(`http://test/api/locations/${locationId}/schedule?weekStart=${farWeek}`),
      { params: Promise.resolve({ locationId }) },
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.schedule.status).toBe("draft");
    expect(body.data.schedule.hasUnpublishedChanges).toBe(false);
    expect(body.data.shifts).toEqual([]);
    expect(body.data.conflictCount).toBe(0);
    expect(body.data.positions.length).toBeGreaterThan(0);
  });

  it("annotates the seeded open shift and double-booking", async () => {
    const currentWeek = weekStartOf(new Date(), NY);
    const shifts: { uiStatus: string; conflicts: { kind: string }[] }[] = [];
    for (const week of [currentWeek, addDaysISO(currentWeek, 7)]) {
      const res = await getSchedule(
        new Request(`http://test/api/locations/${locationId}/schedule?weekStart=${week}`),
        { params: Promise.resolve({ locationId }) },
      );
      const body = await res.json();
      expect(body.ok).toBe(true);
      shifts.push(...body.data.shifts);
    }
    expect(shifts.some((s) => s.uiStatus === "open")).toBe(true);
    const conflicted = shifts.filter((s) => s.uiStatus === "conflict");
    expect(conflicted.length).toBeGreaterThan(0);
    expect(
      conflicted.some((s) => s.conflicts.some((c) => c.kind === "double_booked")),
    ).toBe(true);
  });
});

describe("POST /api/shifts", () => {
  it("warns about a double-booking but still saves (warn, not block)", async () => {
    // Duplicate any seeded assigned shift exactly — guaranteed overlap.
    const existing = await prisma.shift.findFirstOrThrow({
      where: { locationId, employeeProfileId: { not: null } },
    });
    const res = await createShift(
      jsonRequest("http://test/api/shifts", "POST", {
        locationId,
        positionId: existing.positionId,
        employeeProfileId: existing.employeeProfileId,
        date: toISODate(existing.date),
        startTime: formatTime(existing.startsAt, timezone),
        endTime: formatTime(existing.endsAt, timezone),
        notes: "Bring your own knife kit.",
      }),
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    createdShiftIds.push(body.data.shift.id);
    expect(body.data.shift.uiStatus).toBe("conflict");
    expect(body.data.shift.conflicts.some((c: { kind: string }) => c.kind === "double_booked")).toBe(true);
    expect(body.data.shift.notes).toBe("Bring your own knife kit.");
    expect(body.data.shift.status).toBe("draft"); // new shifts are always drafts
  });

  it("rejects an invalid time with specific copy", async () => {
    const position = await prisma.position.findFirstOrThrow({ where: { locationId } });
    const res = await createShift(
      jsonRequest("http://test/api/shifts", "POST", {
        locationId,
        positionId: position.id,
        employeeProfileId: null,
        date: "2026-07-06",
        startTime: "13:00 PM",
        endTime: "5:00 PM",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.message).toBe("Enter a time like 7:00 AM");
  });
});

describe("POST /api/shifts/validate", () => {
  it("reports conflicts without writing anything", async () => {
    const existing = await prisma.shift.findFirstOrThrow({
      where: { locationId, employeeProfileId: { not: null } },
    });
    const before = await prisma.shift.count();
    const res = await validateShift(
      jsonRequest("http://test/api/shifts/validate", "POST", {
        locationId,
        positionId: existing.positionId,
        employeeProfileId: existing.employeeProfileId,
        date: toISODate(existing.date),
        startTime: formatTime(existing.startsAt, timezone),
        endTime: formatTime(existing.endsAt, timezone),
      }),
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.conflicts.some((c: { kind: string }) => c.kind === "double_booked")).toBe(true);
    expect(await prisma.shift.count()).toBe(before);
  });

  it("returns no conflicts for an open shift", async () => {
    const position = await prisma.position.findFirstOrThrow({ where: { locationId } });
    const res = await validateShift(
      jsonRequest("http://test/api/shifts/validate", "POST", {
        locationId,
        positionId: position.id,
        employeeProfileId: null,
        date: "2026-07-06",
        startTime: "9:00 AM",
        endTime: "5:00 PM",
      }),
    );
    expect((await res.json()).data.conflicts).toEqual([]);
  });
});

describe("PATCH + DELETE /api/shifts/[shiftId]", () => {
  it("updates times, then deletes", async () => {
    const position = await prisma.position.findFirstOrThrow({ where: { locationId } });
    const farDate = addDaysISO(weekStartOf(new Date(), NY), 7 * 41);
    createdWeekStarts.push(weekStartOfISO(farDate));
    const createRes = await createShift(
      jsonRequest("http://test/api/shifts", "POST", {
        locationId,
        positionId: position.id,
        employeeProfileId: null,
        date: farDate,
        startTime: "9:00 AM",
        endTime: "5:00 PM",
      }),
    );
    const created = (await createRes.json()).data.shift;
    expect(created.uiStatus).toBe("open");
    expect(created.timeRange).toBe("9:00 AM – 5:00 PM");

    const patchRes = await patchShift(
      jsonRequest(`http://test/api/shifts/${created.id}`, "PATCH", {
        startTime: "10:00 AM",
        endTime: "6:00 PM",
      }),
      { params: Promise.resolve({ shiftId: created.id }) },
    );
    const patched = (await patchRes.json()).data.shift;
    expect(patched.timeRange).toBe("10:00 AM – 6:00 PM");

    const delRes = await deleteShift(
      new Request(`http://test/api/shifts/${created.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ shiftId: created.id }) },
    );
    expect((await delRes.json()).data.deleted).toBe(true);
    expect(await prisma.shift.findUnique({ where: { id: created.id } })).toBeNull();
  });

  it("404s with calm copy for a shift that does not exist", async () => {
    const res = await patchShift(
      jsonRequest("http://test/api/shifts/nope", "PATCH", { startTime: "9:00 AM" }),
      { params: Promise.resolve({ shiftId: "nope" }) },
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe("That shift no longer exists");
  });
});

describe("GET /api/locations/[locationId]/shifts (month counts)", () => {
  it("returns per-day counts for a range", async () => {
    const currentWeek = weekStartOf(new Date(), NY);
    const res = await getShiftCounts(
      new Request(
        `http://test/api/locations/${locationId}/shifts?from=${currentWeek}&to=${addDaysISO(currentWeek, 13)}`,
      ),
      { params: Promise.resolve({ locationId }) },
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    const totals = Object.values(body.data.counts as Record<string, number>);
    expect(totals.length).toBeGreaterThan(0); // seed has shifts in these two weeks
    for (const n of totals) expect(n).toBeGreaterThan(0);
  });

  it("rejects a range longer than 62 days", async () => {
    const res = await getShiftCounts(
      new Request(`http://test/api/locations/${locationId}/shifts?from=2026-01-01&to=2026-06-01`),
      { params: Promise.resolve({ locationId }) },
    );
    expect(res.status).toBe(400);
  });
});
