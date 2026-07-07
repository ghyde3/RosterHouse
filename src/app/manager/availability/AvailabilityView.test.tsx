// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { OverviewDay, OverviewEmployee } from "@/lib/queries/availability";
import type { PositionRef } from "@/lib/availability-view";
import { AvailabilityView } from "./AvailabilityView";

const POSITIONS: PositionRef[] = [
  { id: "cook", name: "Line cook" },
  { id: "server", name: "Server" },
];

function day(over: Partial<OverviewDay> & { dayOfWeek: number }): OverviewDay {
  return {
    date: `2026-07-${String(6 + over.dayOfWeek).padStart(2, "0")}`,
    isAvailable: true,
    startTime: null,
    endTime: null,
    timeOff: false,
    ...over,
  };
}

function emp(
  over: Partial<OverviewEmployee> & { profileId: string; name: string }
): OverviewEmployee {
  return {
    primaryPositionId: null,
    primaryPositionName: null,
    days: Array.from({ length: 7 }, (_, d) => day({ dayOfWeek: d })),
    ...over,
  };
}

const EMPLOYEES: OverviewEmployee[] = [
  emp({
    profileId: "ben",
    name: "Ben Cook",
    primaryPositionId: "cook",
    primaryPositionName: "Line cook",
    days: [
      day({ dayOfWeek: 0, isAvailable: true, startTime: "09:00", endTime: "17:00" }),
      day({ dayOfWeek: 1, isAvailable: false }),
      day({ dayOfWeek: 2, timeOff: true }),
      ...Array.from({ length: 4 }, (_, i) => day({ dayOfWeek: 3 + i })),
    ],
  }),
  emp({
    profileId: "ana",
    name: "Ana Server",
    primaryPositionId: "server",
    primaryPositionName: "Server",
  }),
  emp({ profileId: "cal", name: "Cal NoRole" }), // null primary → Unassigned
];

afterEach(cleanup);

describe("AvailabilityView", () => {
  it("renders one section per occupied primary position plus Unassigned", () => {
    render(<AvailabilityView weekStart="2026-07-06" employees={EMPLOYEES} positions={POSITIONS} />);
    const headers = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headers).toEqual(["Line cook", "Server", "Unassigned"]);
    expect(screen.getByText("Ben Cook")).toBeTruthy();
    expect(screen.getByText("Cal NoRole")).toBeTruthy();
  });

  it("day filter narrows to a single day column", () => {
    render(<AvailabilityView weekStart="2026-07-06" employees={EMPLOYEES} positions={POSITIONS} />);
    // 7 day-head cells per section × 3 sections = 21 by default.
    expect(screen.getAllByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/).length).toBeGreaterThan(3);
    const dayFilter = screen.getByLabelText("Day");
    fireEvent.change(dayFilter, { target: { value: "1" } }); // Tue
    // Ben's Tue is unavailable — its cell text renders.
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    // "Available" windowed Mon cell should no longer be shown.
    expect(screen.queryByText("9:00 AM – 5:00 PM")).toBeNull();
  });

  it("status filter drops non-matching employees and empty sections", () => {
    render(<AvailabilityView weekStart="2026-07-06" employees={EMPLOYEES} positions={POSITIONS} />);
    const statusFilter = screen.getByLabelText("Status");
    fireEvent.change(statusFilter, { target: { value: "unavailable" } });
    // Only Ben has an unavailable day → only the Line cook section remains.
    const headers = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headers).toEqual(["Line cook"]);
    expect(screen.queryByText("Ana Server")).toBeNull();
    expect(screen.queryByText("Cal NoRole")).toBeNull();
  });

  it("shows an empty state when filters exclude everyone", () => {
    const noneTimeOff = EMPLOYEES.map((e) => ({
      ...e,
      days: e.days.map((d) => ({ ...d, timeOff: false })),
    }));
    render(<AvailabilityView weekStart="2026-07-06" employees={noneTimeOff} positions={POSITIONS} />);
    const statusFilter = screen.getByLabelText("Status");
    fireEvent.change(statusFilter, { target: { value: "timeoff" } });
    expect(screen.getByText("No one matches these filters")).toBeTruthy();
  });
});
