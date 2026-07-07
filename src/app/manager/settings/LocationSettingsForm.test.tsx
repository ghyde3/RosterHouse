// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock, push: vi.fn() }) }));
const toastMock = vi.fn();
vi.mock("@/components/ui/Toaster", () => ({ useToast: () => ({ toast: toastMock }) }));

import { LocationSettingsForm, parseOvertimeInput } from "@/app/manager/settings/LocationSettingsForm";

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: true, data: { location: {} } }), {
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  refreshMock.mockClear();
  toastMock.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

function renderForm() {
  return render(
    <LocationSettingsForm
      locationId="loc1"
      name="Harbor & Vine"
      timezone="America/New_York"
      overtimeHoursPerWeek={40}
      address="1 Dock St"
    />,
  );
}

describe("parseOvertimeInput", () => {
  it("returns null for a blank field (overtime conflicts off)", () => {
    expect(parseOvertimeInput("")).toBeNull();
  });

  it("returns the parsed number for valid input", () => {
    expect(parseOvertimeInput("40")).toBe(40);
    expect(parseOvertimeInput("40.5")).toBe(40.5);
  });

  it("flags non-empty junk as invalid instead of coercing NaN to null", () => {
    // A real type="number" input can't produce these strings by typing, but
    // paste, autofill, or a non-JS API caller can — Number("junk") is NaN,
    // which the old code silently serialized as null (turning off overtime
    // conflicts). The guard must catch it before it ever reaches the PATCH.
    expect(parseOvertimeInput("abc")).toBe("invalid");
    expect(parseOvertimeInput("-")).toBe("invalid");
    expect(parseOvertimeInput("NaN")).toBe("invalid");
    expect(parseOvertimeInput("Infinity")).toBe("invalid");
  });
});

describe("LocationSettingsForm", () => {
  it("prefills the current config", () => {
    renderForm();
    expect((screen.getByLabelText("Location name") as HTMLInputElement).value).toBe("Harbor & Vine");
    expect((screen.getByLabelText("Overtime threshold (hours/week)") as HTMLInputElement).value).toBe("40");
    expect((screen.getByLabelText("Address") as HTMLInputElement).value).toBe("1 Dock St");
  });

  it("PATCHes without a confirm when the timezone is unchanged", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderForm();
    fireEvent.change(screen.getByLabelText("Location name"), { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(confirmSpy).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/locations/loc1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      name: "New Name",
      timezone: "America/New_York",
      overtimeHoursPerWeek: 40,
      address: "1 Dock St",
    });
    expect(refreshMock).toHaveBeenCalled();
  });

  it("confirms before saving a timezone change and aborts on cancel", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderForm();
    fireEvent.change(screen.getByLabelText("Time zone"), { target: { value: "America/Los_Angeles" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });

  it("sends null for a blank overtime and blank address", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderForm();
    fireEvent.change(screen.getByLabelText("Overtime threshold (hours/week)"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.overtimeHoursPerWeek).toBeNull();
    expect(body.address).toBeNull();
  });

  it("rejects an empty location name inline without calling the API", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderForm();
    fireEvent.change(screen.getByLabelText("Location name"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByText("Name your location")).toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a danger toast when the API rejects", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: { code: "invalid_input", message: "Choose a valid time zone" } }), {
        headers: { "content-type": "application/json" },
      }),
    );
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    expect(toastMock.mock.calls[0][0]).toMatchObject({ tone: "danger" });
  });
});
