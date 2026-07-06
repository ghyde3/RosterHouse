// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/components/ui/Toaster", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import AssignShiftDialog, {
  employeeOptionLabel,
  qualifiedEmployees,
} from "@/components/schedule/AssignShiftDialog";
import type { EmployeeOption } from "@/lib/schedule-data";

const employees: EmployeeOption[] = [
  {
    employeeProfileId: "ep-maria",
    name: "Maria Garcia",
    positionIds: ["pos-server", "pos-cook"],
    availabilityByDay: ["9:00 AM – 3:00 PM", "All day", "All day", "All day", "All day", "All day", "Off"],
  },
  {
    employeeProfileId: "ep-sam",
    name: "Sam Torres",
    positionIds: ["pos-host"],
    availabilityByDay: ["Off", "All day", "All day", "All day", "All day", "All day", "All day"],
  },
];

const baseProps = {
  open: true,
  locationId: "loc-1",
  positions: [
    { id: "pos-server", name: "Server" },
    { id: "pos-cook", name: "Line cook" },
    { id: "pos-host", name: "Host" },
  ],
  weekDates: ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12"],
  employees,
  onClose: () => {},
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify({
        ok: true,
        data: {
          conflicts: [
            { kind: "double_booked", message: "Overlaps Maria Garcia's 2:00 PM – 6:00 PM Server shift" },
          ],
        },
      }),
      { headers: { "content-type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("qualifiedEmployees", () => {
  it("filters by the EmployeePosition qualification join", () => {
    expect(qualifiedEmployees(employees, "pos-server").map((e) => e.name)).toEqual(["Maria Garcia"]);
    expect(qualifiedEmployees(employees, "pos-host").map((e) => e.name)).toEqual(["Sam Torres"]);
  });
});

describe("employeeOptionLabel", () => {
  it("appends the selected day's availability", () => {
    // 2026-07-06 is a Monday (index 0)
    expect(employeeOptionLabel(employees[0], "2026-07-06")).toBe("Maria Garcia · 9:00 AM – 3:00 PM");
    expect(employeeOptionLabel(employees[1], "2026-07-06")).toBe("Sam Torres · off");
    expect(employeeOptionLabel(employees[0], "2026-07-07")).toBe("Maria Garcia · available all day");
    expect(employeeOptionLabel(employees[0], null)).toBe("Maria Garcia");
  });
});

describe("live validation", () => {
  it("debounces a validate call and renders the conflict chip before save", async () => {
    render(
      <AssignShiftDialog
        {...baseProps}
        initial={{
          positionId: "pos-server",
          date: "2026-07-06",
          employeeProfileId: "ep-maria",
          startTime: "5:00 PM",
          endTime: "11:00 PM",
          notes: "",
        }}
      />,
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/shifts/validate");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      locationId: "loc-1",
      positionId: "pos-server",
      employeeProfileId: "ep-maria",
      date: "2026-07-06",
      startTime: "5:00 PM",
      endTime: "11:00 PM",
    });
    await waitFor(() => {
      expect(screen.getByText("Overlaps Maria Garcia's 2:00 PM – 6:00 PM Server shift")).toBeTruthy();
    });
  });

  it("does not call the API while times are invalid, and save is a no-op", async () => {
    render(
      <AssignShiftDialog
        {...baseProps}
        initial={{
          positionId: "pos-server",
          date: "2026-07-06",
          employeeProfileId: "ep-maria",
          startTime: "13:00 PM",
          endTime: "5:00 PM",
          notes: "",
        }}
      />,
    );
    fireEvent.click(screen.getByText("Save"));
    // Give the 350 ms debounce time to fire if it (wrongly) would.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
