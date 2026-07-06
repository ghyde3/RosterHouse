import { describe, it, expect } from "vitest";
import { normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it("normalizes a formatted US number to E.164", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
  });

  it("normalizes 11 digits starting with 1", () => {
    expect(normalizePhone("1 555 123 4567")).toBe("+15551234567");
  });

  it("keeps international numbers that start with +", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
  });

  it("returns null for anything unparseable", () => {
    expect(normalizePhone("hello")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});
