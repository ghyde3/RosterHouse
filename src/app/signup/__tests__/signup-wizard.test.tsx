/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SignupWizard } from "@/app/signup/SignupWizard";

const signInMock = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({ signIn: signInMock }));

const assignMock = vi.fn();

beforeEach(() => {
  signInMock.mockReset();
  assignMock.mockReset();
  // jsdom defines window.location's `assign` as non-configurable; stub the
  // whole `location` global with a copy that has a mockable `assign`
  // (same workaround as src/app/login/__tests__/login-form.test.tsx).
  vi.stubGlobal("location", { ...window.location, assign: assignMock });
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fillDetailsStep() {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Jamie Park" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jamie@harborvine.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "rosterhouse1" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

describe("SignupWizard", () => {
  it("starts on the details step", () => {
    render(<SignupWizard />);
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
    expect(screen.getByLabelText("Your name")).toBeTruthy();
  });

  it("blocks continue until the details are valid", async () => {
    render(<SignupWizard />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Enter your name.")).toBeTruthy();
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
  });

  it("moves to the business step when details are valid", async () => {
    render(<SignupWizard />);
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Jamie Park" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jamie@harborvine.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "rosterhouse1" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Step 2 of 4")).toBeTruthy();
    expect(screen.getByLabelText("Business name")).toBeTruthy();
  });

  it("recovers the form when the signup request rejects", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network down"));
    render(<SignupWizard />);

    fillDetailsStep();
    await screen.findByText("Step 2 of 4");
    fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "Test Cafe" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Step 3 of 4");
    fireEvent.change(screen.getByLabelText("Location name"), { target: { value: "Main St" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Step 4 of 4");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Something went wrong — try again.")).toBeTruthy();
    const button = screen.getByRole("button", { name: "Create account" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(assignMock).not.toHaveBeenCalled();
    expect(signInMock).not.toHaveBeenCalled();
  });
});
