// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));
vi.mock("@/components/ui/Toaster", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { PositionsView } from "@/components/manager/PositionsView";
import type { PositionRow } from "@/lib/queries/positions";

const active: PositionRow[] = [
  { id: "p-server", name: "Server", sortOrder: 0, archived: false },
  { id: "p-cook", name: "Line cook", sortOrder: 1, archived: false },
  { id: "p-host", name: "Host", sortOrder: 2, archived: false },
];
const archived: PositionRow[] = [
  { id: "p-busser", name: "Busser", sortOrder: 9, archived: true },
];

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  refreshMock.mockClear();
  fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: true, data: { position: { id: "new", name: "New", sortOrder: 3, archivedAt: null } } }), {
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("PositionsView", () => {
  it("lists active positions and the archived section", () => {
    render(<PositionsView active={active} archived={archived} />);
    expect(screen.getByText("Server")).toBeInTheDocument();
    expect(screen.getByText("Line cook")).toBeInTheDocument();
    // Archived section header shows the count.
    expect(screen.getByText(/Archived \(1\)/)).toBeInTheDocument();
  });

  it("collapses the archived section by default", () => {
    render(<PositionsView active={active} archived={archived} />);
    expect(screen.getByText(/Archived \(1\)/)).toHaveAttribute("aria-expanded", "false");
    // Busser is only in the archived list, so it must not be rendered while collapsed.
    expect(screen.queryByText("Busser")).toBeNull();
    fireEvent.click(screen.getByText(/Archived \(1\)/));
    expect(screen.getByText("Busser")).toBeInTheDocument();
  });

  it("POSTs a new position name", async () => {
    render(<PositionsView active={active} archived={archived} />);
    fireEvent.change(screen.getByPlaceholderText("Add a position"), { target: { value: "Bartender" } });
    fireEvent.click(screen.getByText("Add"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/positions");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "Bartender" });
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("does not POST an empty name", async () => {
    render(<PositionsView active={active} archived={archived} />);
    fireEvent.click(screen.getByText("Add"));
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("moving Line cook up reorders via /api/positions/reorder with swapped ids", async () => {
    render(<PositionsView active={active} archived={archived} />);
    // Line cook is index 1; its up-button swaps it with Server (index 0).
    fireEvent.click(screen.getByLabelText("Move Line cook up"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/positions/reorder");
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      orderedIds: ["p-cook", "p-server", "p-host"],
    });
  });

  it("disables Move up on the first row and Move down on the last row", () => {
    render(<PositionsView active={active} archived={archived} />);
    expect(screen.getByLabelText("Move Server up")).toBeDisabled();
    expect(screen.getByLabelText("Move Host down")).toBeDisabled();
  });

  it("archives an active position via PATCH { archived: true }", async () => {
    render(<PositionsView active={active} archived={archived} />);
    fireEvent.click(screen.getByLabelText("Archive Host"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/positions/p-host");
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ archived: true });
  });

  it("unarchives via PATCH { archived: false }", async () => {
    render(<PositionsView active={active} archived={archived} />);
    fireEvent.click(screen.getByText(/Archived \(1\)/)); // expand the collapsed-by-default section
    fireEvent.click(screen.getByText("Unarchive"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/positions/p-busser");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ archived: false });
  });

  it("renames via PATCH { name } from the rename input", async () => {
    render(<PositionsView active={active} archived={archived} />);
    fireEvent.click(screen.getByLabelText("Rename Server"));
    // A rename input appears seeded with the current name.
    const renameInput = screen.getByDisplayValue("Server");
    fireEvent.change(renameInput, { target: { value: "Waiter" } });
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/positions/p-server");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "Waiter" });
  });
});
