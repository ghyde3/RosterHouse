/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ForgotPasswordForm } from "@/app/forgot-password/ForgotPasswordForm";

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("ForgotPasswordForm", () => {
  it("requires an identifier before submitting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ForgotPasswordForm />);
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText("Enter your phone or email.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the trimmed identifier and shows the confirmation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: { requested: true } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Phone or email"), {
      target: { value: "  maria@example.com  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      await screen.findByText(
        "If that matches an account, we sent a password reset link. Check your texts or email.",
      ),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "maria@example.com" }),
    });
    // The form is gone once the confirmation shows.
    expect(screen.queryByLabelText("Phone or email")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to log in" })).toBeTruthy();
  });

  it("shows the server's message when the request is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            ok: false,
            error: { code: "invalid_input", message: "Enter your phone or email." },
          }),
      }),
    );
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Phone or email"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Enter your phone or email.");
  });

  it("falls back to a generic message when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Phone or email"), { target: { value: "(555) 123-4567" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Something went wrong — try again.");
  });
});
