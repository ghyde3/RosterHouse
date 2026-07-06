import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import {
  createTemplate,
  deleteTemplate,
  getTemplateDetail,
  listTemplates,
  updateTemplate,
} from "@/lib/template-data";
import { createFixture, destroyFixture, type Fixture } from "./helpers/factory";

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
