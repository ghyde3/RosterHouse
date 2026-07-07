// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  assignmentsFromPreview,
  defaultMode,
  nextMondays,
} from "@/components/schedule/ApplyTemplateDialog";
import type { TemplatePreview } from "@/lib/template-data";

describe("nextMondays", () => {
  it("returns count Mondays starting at week", () => {
    expect(nextMondays("2026-07-06", 3)).toEqual(["2026-07-06", "2026-07-13", "2026-07-20"]);
  });
});

describe("assignmentsFromPreview", () => {
  it("maps each row to its valid default, or empty string for open", () => {
    const preview = {
      templateId: "t", templateName: "T", targetWeek: "2026-07-06",
      occupancy: { draftCount: 0, publishedCount: 0 },
      rows: [
        { rowId: "r1", defaultEmployeeProfileId: "ep1", conflicts: [] },
        { rowId: "r2", defaultEmployeeProfileId: null, conflicts: [] },
      ],
    } as unknown as TemplatePreview;
    expect(assignmentsFromPreview(preview)).toEqual({ r1: "ep1", r2: "" });
  });
});

describe("defaultMode", () => {
  it("prefers replace when the week already has draft shifts", () => {
    expect(defaultMode({ draftCount: 2, publishedCount: 0 })).toBe("replace");
    expect(defaultMode({ draftCount: 0, publishedCount: 0 })).toBe("add");
  });
});
