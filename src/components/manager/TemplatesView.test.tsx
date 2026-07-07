// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/components/ui/Toaster", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { TemplatesView, templateSubtitle } from "@/components/manager/TemplatesView";
import type { TemplateSummary } from "@/lib/template-data";

const templates: TemplateSummary[] = [
  { id: "t1", name: "Standard week", rowCount: 12, updatedAt: "2026-07-06T12:00:00.000Z" },
  { id: "t2", name: "Weekend crew", rowCount: 4, updatedAt: "2026-07-05T12:00:00.000Z" },
];

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { deleted: true } }), {
    headers: { "content-type": "application/json" },
  }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("templateSubtitle", () => {
  it("summarizes count + updated date", () => {
    expect(templateSubtitle(templates[0])).toContain("12 shifts");
    expect(templateSubtitle({ ...templates[0], rowCount: 1 })).toContain("1 shift ·");
  });
});

describe("TemplatesView", () => {
  it("lists templates", () => {
    render(<TemplatesView currentWeek="2026-07-06" employees={[]} templates={templates} />);
    expect(screen.getByText("Standard week")).toBeTruthy();
    expect(screen.getByText("Weekend crew")).toBeTruthy();
  });

  it("shows an empty state with no templates", () => {
    render(<TemplatesView currentWeek="2026-07-06" employees={[]} templates={[]} />);
    expect(screen.getByText("No templates yet")).toBeTruthy();
  });

  it("deletes a template after confirming", async () => {
    render(<TemplatesView currentWeek="2026-07-06" employees={[]} templates={templates} />);
    fireEvent.click(screen.getAllByText("Delete")[0]); // card action opens the confirm dialog
    fireEvent.click(screen.getByText("Delete template")); // dialog confirm button
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/schedule-templates/t1");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});
