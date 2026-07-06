import { describe, expect, it } from "vitest";
import {
  applyTemplateSchema,
  createTemplateSchema,
  templateRowInputSchema,
  updateTemplateSchema,
} from "@/lib/template-schemas";

describe("templateRowInputSchema", () => {
  const base = {
    positionId: "pos-1",
    employeeProfileId: null,
    dayOfWeek: 0,
    startTime: "7:00 AM",
    endTime: "3:00 PM",
  };

  it("accepts a valid open-slot row", () => {
    expect(templateRowInputSchema.safeParse(base).success).toBe(true);
  });

  it("rejects dayOfWeek out of 0..6", () => {
    expect(templateRowInputSchema.safeParse({ ...base, dayOfWeek: 7 }).success).toBe(false);
  });

  it("rejects a non-12h time", () => {
    expect(templateRowInputSchema.safeParse({ ...base, startTime: "13:00 PM" }).success).toBe(false);
  });
});

describe("createTemplateSchema", () => {
  it("accepts name + fromWeek", () => {
    expect(
      createTemplateSchema.safeParse({ name: "Standard week", fromWeek: "2026-07-06" }).success,
    ).toBe(true);
  });

  it("accepts name + empty rows (blank template)", () => {
    expect(createTemplateSchema.safeParse({ name: "Blank", rows: [] }).success).toBe(true);
  });

  it("rejects when neither fromWeek nor rows is present", () => {
    expect(createTemplateSchema.safeParse({ name: "Bad" }).success).toBe(false);
  });

  it("rejects when both fromWeek and rows are present", () => {
    expect(
      createTemplateSchema.safeParse({ name: "Bad", fromWeek: "2026-07-06", rows: [] }).success,
    ).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(createTemplateSchema.safeParse({ name: "", rows: [] }).success).toBe(false);
  });
});

describe("applyTemplateSchema", () => {
  it("accepts a replace with an assignments map", () => {
    const parsed = applyTemplateSchema.safeParse({
      targetWeek: "2026-07-13",
      mode: "replace",
      assignments: { "row-1": "ep-1", "row-2": null },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown mode", () => {
    expect(
      applyTemplateSchema.safeParse({ targetWeek: "2026-07-13", mode: "merge", assignments: {} }).success,
    ).toBe(false);
  });
});

describe("updateTemplateSchema", () => {
  it("accepts a rename only", () => {
    expect(updateTemplateSchema.safeParse({ name: "Renamed" }).success).toBe(true);
  });
});
