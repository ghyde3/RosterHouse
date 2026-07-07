import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createTestEmployee,
  createTestOrg,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { addDaysISO } from "@/lib/time";
import { todayISOIn } from "@/lib/time-format";
import { DELETE, PUT } from "./route";
import { GET } from "../route";

const authMock = auth as unknown as Mock;

function request(method: "PUT" | "DELETE", body: unknown) {
  return new Request("http://test.local/api/me/availability/exceptions", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const put = (body: unknown) => PUT(request("PUT", body));
const del = (body: unknown) => DELETE(request("DELETE", body));

describe("/api/me/availability/exceptions", () => {
  let t: TestOrg;
  let emp: { userId: string; profileId: string };
  let other: { userId: string; profileId: string };
  let today: string;

  beforeAll(async () => {
    t = await createTestOrg();
    emp = await createTestEmployee(t, "Priya Test");
    other = await createTestEmployee(t, "Omar Test");
    today = todayISOIn(t.timezone);
  });

  beforeEach(() => {
    authMock.mockResolvedValue({
      user: { id: emp.userId, name: "Priya Test", role: "employee", organizationId: t.organizationId },
    });
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("PUT creates an unavailable exception and returns it", async () => {
    const date = addDaysISO(today, 3);
    const res = await put({ date, isAvailable: false, note: "Wedding" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.exception).toEqual({
      date,
      isAvailable: false,
      startTime: null,
      endTime: null,
      note: "Wedding",
    });

    const stored = await prisma.availabilityException.findMany({
      where: { employeeProfileId: emp.profileId },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].isAvailable).toBe(false);
  });

  it("PUT on the same date replaces the exception instead of adding one", async () => {
    const date = addDaysISO(today, 3);
    const res = await put({ date, isAvailable: true, startTime: "12:00", endTime: "18:00" });
    expect(res.status).toBe(200);

    const stored = await prisma.availabilityException.findMany({
      where: { employeeProfileId: emp.profileId },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].isAvailable).toBe(true);
    expect(stored[0].startTime).toBe("12:00");
    expect(stored[0].endTime).toBe("18:00");
    expect(stored[0].note).toBeNull(); // note not resent → cleared, full replace
  });

  it("PUT nulls out times on an unavailable day", async () => {
    const date = addDaysISO(today, 4);
    const res = await put({ date, isAvailable: false, startTime: "09:00", endTime: "17:00" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.exception.startTime).toBeNull();
    expect(body.data.exception.endTime).toBeNull();
    await del({ date });
  });

  it("GET on the parent route returns upcoming exceptions sorted by date", async () => {
    // A past exception must not come back.
    await prisma.availabilityException.create({
      data: {
        employeeProfileId: emp.profileId,
        date: new Date(`${addDaysISO(today, -2)}T00:00:00.000Z`),
        isAvailable: false,
      },
    });
    const later = addDaysISO(today, 10);
    await put({ date: later, isAvailable: false });

    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.rules).toHaveLength(7);
    expect(body.data.exceptions.map((e: { date: string }) => e.date)).toEqual([
      addDaysISO(today, 3),
      later,
    ]);
  });

  it("DELETE removes only the given date", async () => {
    const date = addDaysISO(today, 3);
    const res = await del({ date });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.removed).toBe(true);

    const stored = await prisma.availabilityException.findMany({
      where: { employeeProfileId: emp.profileId, date: { gte: new Date(today) } },
    });
    expect(stored.map((s) => s.date.toISOString().slice(0, 10))).toEqual([addDaysISO(today, 10)]);

    // Deleting a date with no exception reports removed: false.
    const again = await del({ date });
    expect((await again.json()).data.removed).toBe(false);
  });

  it("PUT rejects malformed dates and times", async () => {
    const date = addDaysISO(today, 5);
    expect((await put({ date: "07/15/2026", isAvailable: false })).status).toBe(400);
    expect((await put({ date: "2026-02-30", isAvailable: false })).status).toBe(400);
    expect(
      (await put({ date, isAvailable: true, startTime: "9am", endTime: "17:00" })).status
    ).toBe(400);
  });

  it("PUT rejects one-sided or inverted windows with the pinned messages", async () => {
    const date = addDaysISO(today, 5);
    const oneSided = await put({ date, isAvailable: true, startTime: "09:00" });
    expect(oneSided.status).toBe(400);
    expect((await oneSided.json()).error.message).toBe(
      "Provide both start and end times, or neither."
    );

    const inverted = await put({ date, isAvailable: true, startTime: "17:00", endTime: "09:00" });
    expect(inverted.status).toBe(400);
    expect((await inverted.json()).error.message).toBe("End time must be after start time.");
  });

  it("writes always land on the caller's own profile (tenancy)", async () => {
    const date = addDaysISO(today, 6);
    // A crafted employeeProfileId in the body is ignored by the schema.
    const res = await put({
      date,
      isAvailable: false,
      employeeProfileId: other.profileId,
    });
    expect(res.status).toBe(200);
    expect(
      await prisma.availabilityException.count({ where: { employeeProfileId: other.profileId } })
    ).toBe(0);
    expect(
      await prisma.availabilityException.count({
        where: {
          employeeProfileId: emp.profileId,
          date: new Date(`${date}T00:00:00.000Z`),
        },
      })
    ).toBe(1);

    // Another signed-in employee can't delete it either — their DELETE is a no-op.
    authMock.mockResolvedValue({
      user: { id: other.userId, name: "Omar Test", role: "employee", organizationId: t.organizationId },
    });
    const otherDelete = await del({ date });
    expect((await otherDelete.json()).data.removed).toBe(false);
    expect(
      await prisma.availabilityException.count({
        where: { employeeProfileId: emp.profileId, date: new Date(`${date}T00:00:00.000Z`) },
      })
    ).toBe(1);
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await put({ date: addDaysISO(today, 1), isAvailable: false });
    expect(res.status).toBe(401);
  });
});
