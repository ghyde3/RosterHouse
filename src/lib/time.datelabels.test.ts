import { describe, expect, it } from "vitest";
import { formatDateRange, formatMediumDate } from "@/lib/time";

describe("formatMediumDate", () => {
  it("formats an ISO date as weekday + month + day", () => {
    expect(formatMediumDate("2026-07-12")).toBe("Sun Jul 12");
    expect(formatMediumDate("2026-07-06")).toBe("Mon Jul 6");
  });
});

describe("formatDateRange", () => {
  it("formats a multi-day range with a spaced en dash", () => {
    expect(formatDateRange("2026-07-14", "2026-07-16")).toBe("Jul 14 – Jul 16");
  });
  it("collapses a single-day range to one date", () => {
    expect(formatDateRange("2026-07-20", "2026-07-20")).toBe("Jul 20");
  });
  it("spans months", () => {
    expect(formatDateRange("2026-07-30", "2026-08-02")).toBe("Jul 30 – Aug 2");
  });
});
