// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/Toaster", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import SaveAsTemplateDialog from "@/components/schedule/SaveAsTemplateDialog";

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { template: { id: "t1" } } }), {
    headers: { "content-type": "application/json" },
  }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("SaveAsTemplateDialog", () => {
  it("POSTs the name + fromWeek when saved", async () => {
    render(<SaveAsTemplateDialog open week="2026-07-06" onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Standard week" } });
    fireEvent.click(screen.getByText("Save template"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/schedule-templates");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "Standard week", fromWeek: "2026-07-06" });
  });

  it("does not POST an empty name", async () => {
    render(<SaveAsTemplateDialog open week="2026-07-06" onClose={() => {}} />);
    fireEvent.click(screen.getByText("Save template"));
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
