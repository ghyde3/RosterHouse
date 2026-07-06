/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LoginForm } from "@/app/login/LoginForm";

const signInMock = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({ signIn: signInMock }));

const assignMock = vi.fn();

beforeEach(() => {
  signInMock.mockReset();
  assignMock.mockReset();
  // jsdom (v29 here) defines window.location's `assign` as non-configurable,
  // so neither Object.defineProperty nor vi.spyOn can touch it directly.
  // Stubbing the whole `location` global with a copy that has a mockable
  // `assign` sidesteps that restriction.
  vi.stubGlobal("location", { ...window.location, assign: assignMock });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fillAndSubmit(identifier: string, password: string) {
  fireEvent.change(screen.getByLabelText("Phone or email"), { target: { value: identifier } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
}

describe("LoginForm", () => {
  it("asks for both fields before calling signIn", async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Enter your phone or email and your password.")).toBeTruthy();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("shows the specific mismatch error when credentials fail", async () => {
    signInMock.mockResolvedValue({ error: "CredentialsSignin", ok: false });
    render(<LoginForm />);
    fillAndSubmit("maria@harborvine.test", "wrong-password");
    expect(await screen.findByText("That phone/email or password doesn't match.")).toBeTruthy();
  });

  it("navigates to / on success (middleware routes each role to its home)", async () => {
    signInMock.mockResolvedValue({ error: null, ok: true });
    render(<LoginForm />);
    fillAndSubmit("maria@harborvine.test", "rosterhouse1");
    await vi.waitFor(() => expect(assignMock).toHaveBeenCalledWith("/"));
    expect(signInMock).toHaveBeenCalledWith("credentials", {
      identifier: "maria@harborvine.test",
      password: "rosterhouse1",
      redirect: false,
    });
  });
});
