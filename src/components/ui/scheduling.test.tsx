import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initialsOf } from "@/components/ui/initials";
import { ShiftBlock } from "@/components/ui/ShiftBlock";
import { WeekGridCell } from "@/components/ui/WeekGridCell";
import { AvatarStatus } from "@/components/ui/AvatarStatus";
import { ConflictChip } from "@/components/ui/ConflictChip";

describe("initialsOf", () => {
  it("takes the first letters of the first two words, uppercased", () => {
    expect(initialsOf("Maria Garcia")).toBe("MG");
    expect(initialsOf("Jamie")).toBe("J");
    expect(initialsOf("Ana de la Cruz")).toBe("AD");
    expect(initialsOf("  maria   garcia  ")).toBe("MG");
  });
});

describe("ShiftBlock", () => {
  it("renders a button when clickable and fires onClick", async () => {
    const onClick = vi.fn();
    render(
      <ShiftBlock
        role="Line cook"
        time="7:00 AM – 3:00 PM"
        employeeName="Maria Garcia"
        onClick={onClick}
      />
    );
    const block = screen.getByRole("button");
    expect(block).toHaveTextContent("Line cook");
    expect(block).toHaveTextContent("7:00 AM – 3:00 PM");
    expect(block).toHaveTextContent("Maria Garcia");
    await userEvent.click(block);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders a plain div when not clickable", () => {
    render(<ShiftBlock role="Server" time="4:00 PM – 10:00 PM" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Server")).toBeInTheDocument();
  });

  it("shows the conflict reason only for conflict status", () => {
    const reason = "Overlaps with Sam's 6:00 PM – 10:00 PM shift";
    const { rerender } = render(
      <ShiftBlock
        role="Server"
        time="4:00 PM – 10:00 PM"
        status="conflict"
        conflictReason={reason}
      />
    );
    expect(screen.getByText(reason)).toBeInTheDocument();
    rerender(
      <ShiftBlock
        role="Server"
        time="4:00 PM – 10:00 PM"
        status="confirmed"
        conflictReason={reason}
      />
    );
    expect(screen.queryByText(reason)).not.toBeInTheDocument();
  });
});

describe("WeekGridCell", () => {
  it("renders an accessible add button when empty", async () => {
    const onClick = vi.fn();
    render(<WeekGridCell empty onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Add shift" });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders children in a non-interactive div when not empty", () => {
    render(
      <WeekGridCell>
        <span>7:00 AM – 3:00 PM</span>
      </WeekGridCell>
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("7:00 AM – 3:00 PM")).toBeInTheDocument();
  });

  it("marks conflict cells with a data attribute", () => {
    render(
      <WeekGridCell hasConflict>
        <span>Shift</span>
      </WeekGridCell>
    );
    expect(screen.getByText("Shift").parentElement).toHaveAttribute(
      "data-conflict",
      "true"
    );
  });
});

describe("AvatarStatus", () => {
  it("renders initials and hidden status text (not color-only)", () => {
    render(<AvatarStatus name="Maria Garcia" status="pending" />);
    expect(screen.getByText("MG")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});

describe("ConflictChip", () => {
  it("renders children with a warning icon", () => {
    const { container } = render(
      <ConflictChip>Double-booked with the 2:00 PM shift</ConflictChip>
    );
    expect(
      screen.getByText("Double-booked with the 2:00 PM shift")
    ).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
