/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AcceptInviteForm } from "@/app/invite/[token]/AcceptInviteForm";

const signInMock = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({ signIn: signInMock }));

function renderForm() {
  return render(
    <AcceptInviteForm
      token="tok-1"
      inviterName="Jamie Park"
      locationName="Downtown"
      positionName="Server"
      defaultName="Riley Quinn"
    />,
  );
}

beforeEach(() => {
  signInMock.mockReset();
  vi.unstubAllGlobals();
});

describe("AcceptInviteForm", () => {
  it("explains who invited you and where", () => {
    renderForm();
    expect(screen.getByText(/invited you to join/)).toBeTruthy();
    expect(screen.getByText("Downtown")).toBeTruthy();
  });

  it("validates fields before submitting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Join team" }));
    expect(await screen.findByText("Enter your name.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces the server's message when the phone is taken", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            ok: false,
            error: { code: "phone_taken", message: "That phone number is already on an account. Try logging in instead." },
          }),
      }),
    );
    renderForm();
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "(555) 123-4567" } });
    fireEvent.change(screen.getByLabelText("Create password"), { target: { value: "rosterhouse1" } });
    fireEvent.click(screen.getByRole("button", { name: "Join team" }));
    expect(
      await screen.findByText("That phone number is already on an account. Try logging in instead."),
    ).toBeTruthy();
    expect(signInMock).not.toHaveBeenCalled();
  });
});
