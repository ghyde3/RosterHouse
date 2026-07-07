import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import {
  createTemplate,
  deleteTemplate,
  getTemplateDetail,
  listTemplates,
  resolveTemplateForWeek,
  updateTemplate,
} from "@/lib/template-data";
import { createFixture, createShiftAt, destroyFixture, type Fixture } from "./helpers/factory";
import { addDaysISO, localToUtc, weekStartOf } from "@/lib/time";
import { snapshotWeekToRows } from "@/lib/template-data";
import { prisma } from "@/lib/db";

let f: Fixture;

beforeAll(async () => {
  f = await createFixture();
});
afterAll(async () => {
  await destroyFixture(f);
});

describe("createTemplate / getTemplateDetail", () => {
  it("creates a template with rows and reads it back with resolved names", async () => {
    const detail = await createTemplate(f.locationId, "CRUD template", [
      {
        positionId: f.positionIds.server,
        employeeProfileId: f.ana.profileId,
        dayOfWeek: 0,
        startTime: "7:00 AM",
        endTime: "3:00 PM",
        notes: "Open the floor",
      },
    ]);
    expect(detail.name).toBe("CRUD template");
    expect(detail.rows).toHaveLength(1);
    expect(detail.rows[0].positionName).toBe("Server");
    expect(detail.rows[0].employeeName).toBe("Ana Diaz");
    expect(detail.rows[0].notes).toBe("Open the floor");

    const read = await getTemplateDetail(f.locationId, detail.id);
    expect(read?.rows[0].startTime).toBe("7:00 AM");
  });

  it("rejects a duplicate name at the same location with ApiError 409", async () => {
    await createTemplate(f.locationId, "Dup", []);
    await expect(createTemplate(f.locationId, "Dup", [])).rejects.toMatchObject({
      status: 409,
      code: "name_taken",
    });
  });
});

describe("listTemplates", () => {
  it("returns summaries with a row count", async () => {
    const created = await createTemplate(f.locationId, "Listed", [
      { positionId: f.positionIds.server, employeeProfileId: null, dayOfWeek: 1, startTime: "9:00 AM", endTime: "5:00 PM" },
      { positionId: f.positionIds.server, employeeProfileId: null, dayOfWeek: 2, startTime: "9:00 AM", endTime: "5:00 PM" },
    ]);
    const list = await listTemplates(f.locationId);
    const found = list.find((t) => t.id === created.id);
    expect(found?.rowCount).toBe(2);
  });

  it("does not leak templates from another location", async () => {
    const other = await createFixture();
    try {
      await createTemplate(other.locationId, "Foreign", []);
      const list = await listTemplates(f.locationId);
      expect(list.some((t) => t.name === "Foreign")).toBe(false);
    } finally {
      await destroyFixture(other);
    }
  });
});

describe("updateTemplate / deleteTemplate", () => {
  it("renames and replaces rows", async () => {
    const created = await createTemplate(f.locationId, "Before", [
      { positionId: f.positionIds.server, employeeProfileId: null, dayOfWeek: 0, startTime: "8:00 AM", endTime: "4:00 PM" },
    ]);
    const updated = await updateTemplate(f.locationId, created.id, {
      name: "After",
      rows: [
        { positionId: f.positionIds.dishwasher, employeeProfileId: null, dayOfWeek: 5, startTime: "6:00 PM", endTime: "11:00 PM" },
      ],
    });
    expect(updated?.name).toBe("After");
    expect(updated?.rows).toHaveLength(1);
    expect(updated?.rows[0].positionName).toBe("Dishwasher");
  });

  it("returns null when updating a template at the wrong location", async () => {
    const created = await createTemplate(f.locationId, "Scoped", []);
    const other = await createFixture();
    try {
      const res = await updateTemplate(other.locationId, created.id, { name: "Hijack" });
      expect(res).toBeNull();
    } finally {
      await destroyFixture(other);
    }
  });

  it("deletes and reports found/not-found", async () => {
    const created = await createTemplate(f.locationId, "Doomed", []);
    expect(await deleteTemplate(f.locationId, created.id)).toBe(true);
    expect(await getTemplateDetail(f.locationId, created.id)).toBeNull();
    expect(await deleteTemplate(f.locationId, created.id)).toBe(false);
  });
});

describe("snapshotWeekToRows", () => {
  it("relativizes a week's shifts: open shifts, assignments, and cross-midnight", async () => {
    const week = weekStartOf(new Date(), f.timezone); // Monday ISODate
    // Mon 7:00 AM – 3:00 PM, assigned to Ana
    await createShiftAt(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      startsAt: localToUtc(week, { hour: 7, minute: 0 }, f.timezone),
      endsAt: localToUtc(week, { hour: 15, minute: 0 }, f.timezone),
    });
    // Wed 9:00 AM – 5:00 PM, OPEN
    const wed = addDaysISO(week, 2);
    await createShiftAt(f, {
      positionId: f.positionIds.dishwasher,
      employeeProfileId: null,
      startsAt: localToUtc(wed, { hour: 9, minute: 0 }, f.timezone),
      endsAt: localToUtc(wed, { hour: 17, minute: 0 }, f.timezone),
    });
    // Fri 8:00 PM – 2:00 AM (crosses midnight), assigned to Ben
    const fri = addDaysISO(week, 4);
    await createShiftAt(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ben.profileId,
      startsAt: localToUtc(fri, { hour: 20, minute: 0 }, f.timezone),
      endsAt: localToUtc(addDaysISO(fri, 1), { hour: 2, minute: 0 }, f.timezone),
    });

    const rows = await snapshotWeekToRows(f.locationId, week);
    expect(rows).toHaveLength(3);

    const mon = rows.find((r) => r.dayOfWeek === 0)!;
    expect(mon).toMatchObject({
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      startTime: "7:00 AM",
      endTime: "3:00 PM",
    });

    const wedRow = rows.find((r) => r.dayOfWeek === 2)!;
    expect(wedRow.employeeProfileId).toBeNull();
    expect(wedRow.startTime).toBe("9:00 AM");

    const friRow = rows.find((r) => r.dayOfWeek === 4)!;
    expect(friRow.employeeProfileId).toBe(f.ben.profileId);
    expect(friRow).toMatchObject({ startTime: "8:00 PM", endTime: "2:00 AM" });
  });
});

describe("resolveTemplateForWeek", () => {
  it("resolves dates, occupancy, conflict hints, and drops invalid assignees to open", async () => {
    const targetWeek = addDaysISO(weekStartOf(new Date(), f.timezone), 7); // next Monday
    const template = await createTemplate(f.locationId, "Resolve me", [
      { positionId: f.positionIds.server, employeeProfileId: f.ana.profileId, dayOfWeek: 0, startTime: "9:00 AM", endTime: "5:00 PM" },
      { positionId: f.positionIds.dishwasher, employeeProfileId: null, dayOfWeek: 1, startTime: "9:00 AM", endTime: "5:00 PM" },
    ]);

    // A pre-existing DRAFT shift for Ana that overlaps her Monday row → conflict + occupancy.
    const mon = targetWeek;
    await createShiftAt(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      startsAt: localToUtc(mon, { hour: 10, minute: 0 }, f.timezone),
      endsAt: localToUtc(mon, { hour: 14, minute: 0 }, f.timezone),
      status: "draft",
    });

    const preview = (await resolveTemplateForWeek(f.locationId, template.id, targetWeek, f.timezone))!;
    expect(preview.targetWeek).toBe(targetWeek);
    expect(preview.occupancy.draftCount).toBe(1);
    expect(preview.occupancy.publishedCount).toBe(0);

    const anaRow = preview.rows.find((r) => r.dayOfWeek === 0)!;
    expect(anaRow.date).toBe(mon);
    expect(anaRow.employeeValid).toBe(true);
    expect(anaRow.defaultEmployeeName).toBe("Ana Diaz");
    expect(anaRow.conflicts.some((c) => c.kind === "double_booked")).toBe(true);

    const openRow = preview.rows.find((r) => r.dayOfWeek === 1)!;
    expect(openRow.employeeValid).toBe(false);
    expect(openRow.conflicts).toEqual([]);

    // Point Ana's row at a foreign-location profile: exists (FK ok) but not on this team.
    const other = await createFixture();
    try {
      await prisma.scheduleTemplateRow.update({
        where: { id: anaRow.rowId },
        data: { employeeProfileId: other.ana.profileId },
      });
      const reprev = (await resolveTemplateForWeek(f.locationId, template.id, targetWeek, f.timezone))!;
      const staleRow = reprev.rows.find((r) => r.dayOfWeek === 0)!;
      expect(staleRow.employeeValid).toBe(false);
      expect(staleRow.defaultEmployeeProfileId).toBeNull();
      expect(staleRow.conflicts).toEqual([]);
    } finally {
      await destroyFixture(other);
    }
  });

  it("returns null for a template at another location", async () => {
    const t = await createTemplate(f.locationId, "Scoped preview", []);
    const other = await createFixture();
    try {
      expect(await resolveTemplateForWeek(other.locationId, t.id, weekStartOf(new Date(), other.timezone), other.timezone)).toBeNull();
    } finally {
      await destroyFixture(other);
    }
  });
});
