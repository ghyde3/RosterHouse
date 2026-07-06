import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

describe("Dialog", () => {
  it("renders nothing when closed", () => {
    render(
      <Dialog open={false} title="Assign shift">
        Body
      </Dialog>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders title and children in a dialog role when open", () => {
    render(
      <Dialog open title="Assign shift">
        Pick an employee
      </Dialog>
    );
    const dialog = screen.getByRole("dialog", { name: "Assign shift" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("Pick an employee");
  });

  it("closes on scrim click but not on panel click", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Assign shift">
        Body
      </Dialog>
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("dialog-scrim"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Assign shift">
        Body
      </Dialog>
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus into the dialog and traps Tab", async () => {
    render(
      <Dialog
        open
        title="Assign shift"
        footer={
          <>
            <Button variant="secondary">Cancel</Button>
            <Button>Save</Button>
          </>
        }
      >
        Body
      </Dialog>
    );
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const save = screen.getByRole("button", { name: "Save" });
    expect(cancel).toHaveFocus(); // initial focus = first focusable
    await userEvent.tab();
    expect(save).toHaveFocus();
    await userEvent.tab(); // wraps to first
    expect(cancel).toHaveFocus();
    await userEvent.tab({ shift: true }); // wraps back to last
    expect(save).toHaveFocus();
  });

  it("restores focus to the trigger when closed", () => {
    function Harness({ open }: { open: boolean }) {
      return (
        <>
          <button type="button">Open dialog</button>
          <Dialog open={open} title="Assign shift">
            Body
          </Dialog>
        </>
      );
    }
    const { rerender } = render(<Harness open={false} />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    trigger.focus();
    rerender(<Harness open={true} />);
    expect(trigger).not.toHaveFocus();
    rerender(<Harness open={false} />);
    expect(trigger).toHaveFocus();
  });
});
