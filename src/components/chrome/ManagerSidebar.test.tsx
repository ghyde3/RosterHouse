// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/manager/timesheets",
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { ManagerSidebar } from "@/components/chrome/ManagerSidebar";
import { ToasterProvider } from "@/components/ui/Toaster";

afterEach(cleanup);

function renderSidebar(props: Partial<React.ComponentProps<typeof ManagerSidebar>> = {}) {
  return render(
    <ToasterProvider>
      <ManagerSidebar locationName="Test location" userName="Test Manager" {...props} />
    </ToasterProvider>,
  );
}

describe("ManagerSidebar", () => {
  it("shows a Timesheets link that is active on the timesheets route", () => {
    renderSidebar();
    const link = screen.getByRole("link", { name: /timesheets/i });
    expect(link.getAttribute("href")).toBe("/manager/timesheets");
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("shows the plain location line for a single-location org", () => {
    renderSidebar({
      locations: [{ id: "loc-1", name: "Test location" }],
      activeLocationId: "loc-1",
    });
    expect(screen.getByText("Test location")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /location/i })).not.toBeInTheDocument();
  });

  it("shows the location dropdown only when there is more than one location", () => {
    renderSidebar({
      locations: [
        { id: "loc-1", name: "Downtown" },
        { id: "loc-2", name: "Uptown" },
      ],
      activeLocationId: "loc-2",
    });
    const select = screen.getByRole("combobox", { name: /location/i });
    expect(select).toHaveValue("loc-2");
    expect(screen.getByRole("option", { name: "Downtown" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Uptown" })).toBeInTheDocument();
  });
});
