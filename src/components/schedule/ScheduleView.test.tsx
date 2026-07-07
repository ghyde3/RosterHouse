// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
vi.mock("@/components/ui/Toaster", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import ScheduleView from "@/components/schedule/ScheduleView";
import type { ScheduleWeekData } from "@/lib/schedule-data";

function weekData(overrides: Partial<ScheduleWeekData> = {}): ScheduleWeekData {
  return {
    schedule: { id: "sched-1", status: "draft", publishedAt: null, hasUnpublishedChanges: false },
    weekStart: "2026-07-06",
    positions: [{ id: "pos-server", name: "Server", archived: false }],
    shifts: [],
    conflictCount: 0,
    assignedEmployeeCount: 0,
    ...overrides,
  };
}

const baseProps = {
  locationId: "loc-1",
  currentWeek: "2026-07-06",
  view: "week" as const,
  week: "2026-07-06",
  day: "2026-07-06",
  month: "2026-07",
  monthCounts: null,
  employees: [],
};

afterEach(() => {
  cleanup();
  push.mockClear();
});

describe("ScheduleView header", () => {
  it("shows the Draft badge and no conflict chip on a clean draft week", () => {
    render(<ScheduleView {...baseProps} data={weekData()} />);
    expect(screen.getByText("Schedule")).toBeTruthy();
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.queryByText(/conflict/)).toBeNull();
  });

  it("shows a singular/plural conflict chip", () => {
    render(<ScheduleView {...baseProps} data={weekData({ conflictCount: 2 })} />);
    expect(screen.getByText("2 conflicts to resolve")).toBeTruthy();
  });

  it("header add shift button opens the dialog with position and day selects", () => {
    render(<ScheduleView {...baseProps} data={weekData()} />);
    fireEvent.click(screen.getByText("Add shift"));
    expect(screen.getByText("Assign shift")).toBeTruthy(); // dialog title
  });

  it("excludes an archived position (kept in the grid) from the assign-shift picker", () => {
    render(
      <ScheduleView
        {...baseProps}
        data={weekData({
          positions: [
            { id: "pos-server", name: "Server", archived: false },
            { id: "pos-busser", name: "Busser", archived: true },
          ],
        })}
      />,
    );
    // Grid still renders the archived-with-shift-this-week position header,
    // via WeekGrid's positionLabel (present before the dialog is even open).
    expect(screen.getByText("Busser")).toBeTruthy();
    fireEvent.click(screen.getByText("Add shift"));
    // ...but the assign dialog's Position select must not offer it as an option.
    expect(screen.queryByRole("option", { name: "Busser" })).toBeNull();
    expect(screen.getByRole("option", { name: "Server" })).toBeTruthy();
  });

  it("draft week shows the publish button with the assigned count in the dialog", () => {
    render(<ScheduleView {...baseProps} data={weekData({ assignedEmployeeCount: 3 })} />);
    fireEvent.click(screen.getByText("Publish schedule"));
    expect(screen.getByText("Publish this week's schedule?")).toBeTruthy();
    expect(screen.getByText("3 employees will be notified.")).toBeTruthy();
  });

  it("published week with unpublished changes relabels the button", () => {
    render(
      <ScheduleView
        {...baseProps}
        data={weekData({
          schedule: {
            id: "sched-1",
            status: "published",
            publishedAt: "2026-07-01T12:00:00.000Z",
            hasUnpublishedChanges: true,
          },
        })}
      />,
    );
    expect(screen.getByText("Unpublished changes")).toBeTruthy();
    expect(screen.getByText("Publish changes")).toBeTruthy();
  });

  it("published week with no changes shows no publish button", () => {
    render(
      <ScheduleView
        {...baseProps}
        data={weekData({
          schedule: {
            id: "sched-1",
            status: "published",
            publishedAt: "2026-07-01T12:00:00.000Z",
            hasUnpublishedChanges: false,
          },
        })}
      />,
    );
    expect(screen.getByText("Published")).toBeTruthy();
    expect(screen.queryByText("Publish schedule")).toBeNull();
    expect(screen.queryByText("Publish changes")).toBeNull();
  });
});

describe("ScheduleView navigation", () => {
  it("switching tabs pushes the view param", () => {
    render(<ScheduleView {...baseProps} data={weekData()} />);
    fireEvent.click(screen.getByText("Month"));
    expect(push).toHaveBeenCalledWith("/manager/schedule?view=month&week=2026-07-06&month=2026-07");
  });

  it("pager renders prev/next/today as links built from URL state", () => {
    render(<ScheduleView {...baseProps} data={weekData()} />);
    // DatePager is link-based (Phase 1) — no callbacks, real anchors.
    expect(screen.getByRole("link", { name: "Previous week" }).getAttribute("href")).toBe(
      "/manager/schedule?view=week&week=2026-06-29",
    );
    expect(screen.getByRole("link", { name: "Next week" }).getAttribute("href")).toBe(
      "/manager/schedule?view=week&week=2026-07-13",
    );
    expect(screen.getByRole("link", { name: "Today" }).getAttribute("href")).toBe(
      "/manager/schedule?view=week&week=2026-07-06",
    );
  });
});
