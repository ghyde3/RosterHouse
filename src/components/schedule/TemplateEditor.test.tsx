// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { detailRowsToEditor, editorRowsToInput } from "@/components/schedule/TemplateEditor";
import type { TemplateRow } from "@/lib/template-data";

describe("editor row conversions", () => {
  it("round-trips detail rows to editor rows to inputs", () => {
    const detail: TemplateRow[] = [
      {
        id: "row-1", positionId: "pos-1", positionName: "Server", employeeProfileId: "ep-1",
        employeeName: "Ana", dayOfWeek: 0, startTime: "9:00 AM", endTime: "5:00 PM", notes: "Open",
      },
    ];
    const editor = detailRowsToEditor(detail);
    expect(editor[0]).toMatchObject({ key: "row-1", positionId: "pos-1", dayOfWeek: 0, startTime: "9:00 AM" });

    const input = editorRowsToInput(editor);
    expect(input[0]).toEqual({
      positionId: "pos-1", employeeProfileId: "ep-1", dayOfWeek: 0, startTime: "9:00 AM", endTime: "5:00 PM", notes: "Open",
    });
    expect("key" in input[0]).toBe(false);
  });
});
