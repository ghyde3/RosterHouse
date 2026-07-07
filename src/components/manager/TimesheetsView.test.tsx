// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/components/ui/Toaster", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { TimesheetsView, formatCost } from "@/components/manager/TimesheetsView";
import type { TimesheetWeekData } from "@/lib/timesheet-data";

const data: TimesheetWeekData = {
  weekStart: "2026-07-06",
  overtimeHoursPerWeek: 40,
  employees: [
    {
      profileId: "p1",
      name: "Ana Diaz",
      primaryPositionName: "Server",
      hourlyRate: 20,
      hoursActual: 8,
      laborCost: 160,
      lateCount: 0,
      noShowCount: 0,
      overtime: false,
      entries: [
        {
          id: "e1",
          date: "2026-07-06",
          clockInAt: "2026-07-06T13:00:00.000Z",
          clockOutAt: "2026-07-06T21:00:00.000Z",
          hours: 8,
          shiftId: "s1",
          shiftLabel: "9:00 AM – 5:00 PM",
          incomplete: false,
          late: false,
          edited: false,
        },
      ],
    },
    {
      profileId: "p2",
      name: "Ben Cho",
      primaryPositionName: null,
      hourlyRate: null,
      hoursActual: 4,
      laborCost: null,
      lateCount: 1,
      noShowCount: 1,
      overtime: false,
      entries: [
        {
          id: "e2",
          date: "2026-07-07",
          clockInAt: "2026-07-07T13:10:00.000Z",
          clockOutAt: null,
          hours: 0,
          shiftId: "s2",
          shiftLabel: "9:00 AM – 5:00 PM",
          incomplete: true,
          late: true,
          edited: false,
        },
      ],
    },
  ],
};

const baseProps = {
  locationId: "loc1",
  weekStart: "2026-07-06",
  weekLabel: "Week of Jul 6",
  prevHref: "/manager/timesheets?week=2026-06-29",
  nextHref: "/manager/timesheets?week=2026-07-13",
  todayHref: "/manager/timesheets",
  data,
};

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

describe("formatCost", () => {
  it("formats a number as dollars and null as an em dash", () => {
    expect(formatCost(160)).toBe("$160");
    expect(formatCost(null)).toBe("—");
  });
});

describe("TimesheetsView", () => {
  it("lists each employee with hours, cost, and flag badges", () => {
    render(<TimesheetsView {...baseProps} />);
    expect(screen.getByText("Ana Diaz")).toBeTruthy();
    expect(screen.getByText("Ben Cho")).toBeTruthy();
    expect(screen.getByText("$160")).toBeTruthy();
    expect(screen.getByText(/1 late/)).toBeTruthy();
    expect(screen.getByText(/1 no-show/)).toBeTruthy();
  });

  it("shows an empty state when there are no employees", () => {
    render(<TimesheetsView {...baseProps} data={{ ...data, employees: [] }} />);
    expect(screen.getByText("No timesheets this week")).toBeTruthy();
  });

  it("expands an employee to reveal punch rows and deletes a punch", async () => {
    render(<TimesheetsView {...baseProps} />);
    fireEvent.click(screen.getByText("Ana Diaz")); // expand
    fireEvent.click(screen.getByRole("button", { name: "Delete punch" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" })); // dialog confirm
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/time-clock-entries/e1");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("has a CSV download link pointing at the export route", () => {
    render(<TimesheetsView {...baseProps} />);
    const link = screen.getByRole("link", { name: /export csv/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(
      "/api/locations/loc1/timesheets/export?weekStart=2026-07-06",
    );
  });
});
