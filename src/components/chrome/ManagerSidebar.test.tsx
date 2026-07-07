// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/manager/timesheets" }));

import { ManagerSidebar } from "@/components/chrome/ManagerSidebar";

afterEach(cleanup);

describe("ManagerSidebar", () => {
  it("shows a Timesheets link that is active on the timesheets route", () => {
    render(<ManagerSidebar locationName="Test location" userName="Test Manager" />);
    const link = screen.getByRole("link", { name: /timesheets/i });
    expect(link.getAttribute("href")).toBe("/manager/timesheets");
    expect(link.getAttribute("aria-current")).toBe("page");
  });
});
