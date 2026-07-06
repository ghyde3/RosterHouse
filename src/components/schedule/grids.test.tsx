// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DayList from "@/components/schedule/DayList";
import MonthGrid from "@/components/schedule/MonthGrid";
import WeekGrid from "@/components/schedule/WeekGrid";
import type { ScheduleShift } from "@/lib/schedule-data";

afterEach(cleanup);

const positions = [
  { id: "pos-cook", name: "Line cook" },
  { id: "pos-server", name: "Server" },
];
const weekDates = ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12"];

function shift(overrides: Partial<ScheduleShift>): ScheduleShift {
  return {
    id: "s1",
    positionId: "pos-server",
    positionName: "Server",
    employeeProfileId: "ep-maria",
    employeeName: "Maria Garcia",
    date: "2026-07-06",
    startsAt: "2026-07-06T15:00:00.000Z",
    endsAt: "2026-07-06T23:00:00.000Z",
    timeRange: "11:00 AM – 7:00 PM",
    status: "draft",
    notes: null,
    uiStatus: "draft",
    conflicts: [],
    ...overrides,
  };
}

describe("WeekGrid", () => {
  it("renders positions as rows and shifts in their cells", () => {
    render(
      <WeekGrid
        positions={positions}
        weekDates={weekDates}
        shifts={[shift({})]}
        onCellClick={vi.fn()}
        onShiftClick={vi.fn()}
      />,
    );
    expect(screen.getByText("Line cook")).toBeTruthy();
    expect(screen.getByText("Server")).toBeTruthy();
    expect(screen.getByText("Mon 6")).toBeTruthy();
    expect(screen.getByText("Maria Garcia")).toBeTruthy();
  });

  it("empty cells are WeekGridCell's own labeled add buttons that report position and date", () => {
    const onCellClick = vi.fn();
    render(
      <WeekGrid
        positions={positions}
        weekDates={weekDates}
        shifts={[]}
        onCellClick={onCellClick}
        onShiftClick={vi.fn()}
      />,
    );
    // Phase 1's WeekGridCell renders the <button aria-label={addLabel}> itself
    // when empty — WeekGrid supplies onClick + addLabel and no children.
    const button = screen.getByLabelText("Add Server shift on Mon 6");
    expect(button.tagName).toBe("BUTTON");
    fireEvent.click(button);
    expect(onCellClick).toHaveBeenCalledWith("pos-server", "2026-07-06");
  });

  it("occupied cells keep an in-cell add button below their shifts", () => {
    const onCellClick = vi.fn();
    render(
      <WeekGrid
        positions={positions}
        weekDates={weekDates}
        shifts={[shift({})]}
        onCellClick={onCellClick}
        onShiftClick={vi.fn()}
      />,
    );
    // The Server / Mon 6 cell is occupied, so this is WeekGrid's custom
    // "+ Add" button rendered as a child — not the WeekGridCell empty button.
    const button = screen.getByLabelText("Add Server shift on Mon 6");
    expect(button.tagName).toBe("BUTTON");
    expect(button.textContent).toContain("+ Add");
    fireEvent.click(button);
    expect(onCellClick).toHaveBeenCalledWith("pos-server", "2026-07-06");
  });

  it("clicking a shift block opens edit", () => {
    const onShiftClick = vi.fn();
    const s = shift({});
    render(
      <WeekGrid
        positions={positions}
        weekDates={weekDates}
        shifts={[s]}
        onCellClick={vi.fn()}
        onShiftClick={onShiftClick}
      />,
    );
    fireEvent.click(screen.getByText("Maria Garcia"));
    expect(onShiftClick).toHaveBeenCalledWith(s);
  });

  it("shows an empty state banner when the week has no shifts", () => {
    render(
      <WeekGrid
        positions={positions}
        weekDates={weekDates}
        shifts={[]}
        onCellClick={vi.fn()}
        onShiftClick={vi.fn()}
      />,
    );
    expect(screen.getByText("No shifts scheduled this week yet")).toBeTruthy();
  });
});

describe("DayList", () => {
  it("groups by position with an empty message when the day is blank", () => {
    render(
      <DayList
        positions={positions}
        date="2026-07-07"
        shifts={[]}
        onAddClick={vi.fn()}
        onShiftClick={vi.fn()}
      />,
    );
    expect(screen.getByText("No shifts scheduled for this day yet.")).toBeTruthy();
    const button = screen.getByLabelText("Add Line cook shift");
    expect(button.tagName).toBe("BUTTON");
  });

  it("add button reports the position", () => {
    const onAddClick = vi.fn();
    render(
      <DayList
        positions={positions}
        date="2026-07-06"
        shifts={[shift({})]}
        onAddClick={onAddClick}
        onShiftClick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("Add Server shift"));
    expect(onAddClick).toHaveBeenCalledWith("pos-server");
  });
});

describe("MonthGrid", () => {
  it("renders 42 day buttons keyed by full date — no cross-month collisions", () => {
    render(
      <MonthGrid month="2026-07" counts={{ "2026-07-10": 3, "2026-07-11": 1 }} onSelectDay={vi.fn()} />,
    );
    // Grid runs Mon Jun 29 – Sun Aug 9: the day number "1" appears for both
    // Jul 1 and Aug 1 (the export's key collision bug would drop one).
    expect(screen.getAllByText("1")).toHaveLength(2);
    expect(screen.getByText("3 shifts")).toBeTruthy();
    expect(screen.getByText("1 shift")).toBeTruthy();
  });

  it("clicking a day reports its ISO date", () => {
    const onSelectDay = vi.fn();
    render(<MonthGrid month="2026-07" counts={{}} onSelectDay={onSelectDay} />);
    fireEvent.click(screen.getByLabelText("View Friday, July 10"));
    expect(onSelectDay).toHaveBeenCalledWith("2026-07-10");
  });
});
