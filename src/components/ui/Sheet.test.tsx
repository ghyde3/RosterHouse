import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet } from "@/components/ui/Sheet";

describe("Sheet", () => {
  it("renders nothing when closed", () => {
    render(
      <Sheet open={false} title="Request swap">
        Body
      </Sheet>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders a modal dialog with title and children when open", () => {
    render(
      <Sheet open title="Request swap">
        Who should cover this shift?
      </Sheet>
    );
    const sheet = screen.getByRole("dialog", { name: "Request swap" });
    expect(sheet).toHaveAttribute("aria-modal", "true");
    expect(sheet).toHaveTextContent("Who should cover this shift?");
  });

  it("closes on scrim click and on Escape, not on panel click", async () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Request swap">
        Body
      </Sheet>
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("sheet-scrim"));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("moves focus into the sheet on open", () => {
    render(
      <Sheet
        open
        title="Request swap"
        footer={<button type="button">Send request</button>}
      >
        Body
      </Sheet>
    );
    expect(
      screen.getByRole("button", { name: "Send request" })
    ).toHaveFocus();
  });
});
