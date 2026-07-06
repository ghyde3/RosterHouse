import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ManagerSidebar } from "@/components/chrome/ManagerSidebar";
import { EmployeeTabBar } from "@/components/chrome/EmployeeTabBar";
import { EmployeeTopBar } from "@/components/chrome/EmployeeTopBar";
import { DatePager } from "@/components/chrome/DatePager";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: pathnameMock,
}));

describe("ManagerSidebar", () => {
  it("renders all six nav items as real links", () => {
    pathnameMock.mockReturnValue("/manager");
    render(<ManagerSidebar locationName="Downtown" userName="Jamie Park" />);
    const expected: Array<[string, string]> = [
      ["Dashboard", "/manager"],
      ["Schedule", "/manager/schedule"],
      ["Team", "/manager/team"],
      ["Availability", "/manager/availability"],
      ["Time off", "/manager/time-off"],
      ["Swaps & open shifts", "/manager/swaps"],
    ];
    for (const [name, href] of expected) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("marks the current section with aria-current", () => {
    pathnameMock.mockReturnValue("/manager/schedule");
    render(<ManagerSidebar locationName="Downtown" userName="Jamie Park" />);
    expect(screen.getByRole("link", { name: "Schedule" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("link", { name: "Dashboard" })
    ).not.toHaveAttribute("aria-current");
  });

  it("shows location, user name, and user initials", () => {
    pathnameMock.mockReturnValue("/manager");
    render(<ManagerSidebar locationName="Downtown" userName="Jamie Park" />);
    expect(screen.getByText("Downtown")).toBeInTheDocument();
    expect(screen.getByText("Jamie Park")).toBeInTheDocument();
    expect(screen.getByText("JP")).toBeInTheDocument();
  });
});

describe("EmployeeTabBar", () => {
  it("renders five tab links and marks the active one", () => {
    pathnameMock.mockReturnValue("/clock");
    render(<EmployeeTabBar />);
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: /Clock/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("keeps Shifts active on a shift detail page", () => {
    pathnameMock.mockReturnValue("/shifts/abc123");
    render(<EmployeeTabBar />);
    expect(screen.getByRole("link", { name: /Shifts/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});

describe("EmployeeTopBar", () => {
  it("renders the title as a heading and an optional back link", () => {
    render(<EmployeeTopBar title="Shift detail" backHref="/shifts" />);
    expect(
      screen.getByRole("heading", { name: "Shift detail" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/shifts"
    );
  });

  it("renders the action slot", () => {
    render(
      <EmployeeTopBar
        title="Hi, Maria"
        action={<button type="button">Notifications</button>}
      />
    );
    expect(
      screen.getByRole("button", { name: "Notifications" })
    ).toBeInTheDocument();
  });
});

describe("DatePager", () => {
  it("renders prev/next/today as links around the label", () => {
    render(
      <DatePager
        label="Jul 6 – Jul 12"
        prevHref="/manager/schedule?week=2026-06-29"
        nextHref="/manager/schedule?week=2026-07-13"
        todayHref="/manager/schedule"
        prevLabel="Previous week"
        nextLabel="Next week"
      />
    );
    expect(screen.getByText("Jul 6 – Jul 12")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Previous week" })
    ).toHaveAttribute("href", "/manager/schedule?week=2026-06-29");
    expect(screen.getByRole("link", { name: "Next week" })).toHaveAttribute(
      "href",
      "/manager/schedule?week=2026-07-13"
    );
    expect(screen.getByRole("link", { name: "Today" })).toHaveAttribute(
      "href",
      "/manager/schedule"
    );
  });

  it("omits Today when no todayHref is given", () => {
    render(<DatePager label="Jul 6 – Jul 12" prevHref="/a" nextHref="/b" />);
    expect(screen.queryByRole("link", { name: "Today" })).not.toBeInTheDocument();
  });
});
