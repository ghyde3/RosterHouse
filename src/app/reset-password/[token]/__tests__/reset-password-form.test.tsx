/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResetPasswordForm } from "@/app/reset-password/[token]/ResetPasswordForm";

function renderForm() {
  return render(<ResetPasswordForm token="tok-1" userName="Maria Garcia" />);
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("ResetPasswordForm", () => {
  it("rejects a short password before submitting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(await screen.findByText("Password needs at least 8 characters.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords before submitting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "rosterhouse1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "rosterhouse2" } });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(await screen.findByText("Passwords don't match.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the token and password, then shows the success state", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: { reset: true } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "rosterhouse1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "rosterhouse1" } });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));

    expect(await screen.findByText("Password updated. Log in with your new password.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "tok-1", password: "rosterhouse1" }),
    });
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(screen.getByRole("link", { name: "Go to log in" })).toBeTruthy();
  });

  it("surfaces the server's message for a used link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            ok: false,
            error: { code: "reset_used", message: "That reset link was already used. Request a new one." },
          }),
      }),
    );
    renderForm();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "rosterhouse1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "rosterhouse1" } });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("That reset link was already used. Request a new one.");
  });

  it("shows a generic message for unexpected errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            ok: false,
            error: { code: "internal_error", message: "Detailed internals should not leak." },
          }),
      }),
    );
    renderForm();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "rosterhouse1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "rosterhouse1" } });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Something went wrong — try again.");
  });
});
