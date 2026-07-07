// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createEntrySchema, updateEntrySchema } from "@/lib/timesheet-schemas";

describe("createEntrySchema", () => {
  it("accepts a valid completed punch", () => {
    const r = createEntrySchema.safeParse({
      employeeProfileId: "p1",
      clockInAt: "2026-07-06T13:00:00.000Z",
      clockOutAt: "2026-07-06T21:00:00.000Z",
      shiftId: "s1",
    });
    expect(r.success).toBe(true);
  });
  it("accepts an open punch (no clock-out)", () => {
    const r = createEntrySchema.safeParse({
      employeeProfileId: "p1",
      clockInAt: "2026-07-06T13:00:00.000Z",
    });
    expect(r.success).toBe(true);
  });
  it("rejects a missing employeeProfileId", () => {
    const r = createEntrySchema.safeParse({ clockInAt: "2026-07-06T13:00:00.000Z" });
    expect(r.success).toBe(false);
  });
  it("rejects a non-datetime clockInAt", () => {
    const r = createEntrySchema.safeParse({ employeeProfileId: "p1", clockInAt: "nope" });
    expect(r.success).toBe(false);
  });
  it("rejects clock-out before clock-in", () => {
    const r = createEntrySchema.safeParse({
      employeeProfileId: "p1",
      clockInAt: "2026-07-06T21:00:00.000Z",
      clockOutAt: "2026-07-06T13:00:00.000Z",
    });
    expect(r.success).toBe(false);
  });
});

describe("updateEntrySchema", () => {
  it("accepts a partial clock-out edit", () => {
    expect(updateEntrySchema.safeParse({ clockOutAt: "2026-07-06T21:00:00.000Z" }).success).toBe(true);
  });
  it("accepts clearing the clock-out to null", () => {
    expect(updateEntrySchema.safeParse({ clockOutAt: null }).success).toBe(true);
  });
  it("rejects a bad clockInAt", () => {
    expect(updateEntrySchema.safeParse({ clockInAt: "nope" }).success).toBe(false);
  });
});
