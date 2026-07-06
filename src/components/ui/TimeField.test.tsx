import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { TimeField } from "@/components/ui/TimeField";

const ERROR = "Enter a time like 7:00 AM";

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <TimeField label="Start time" value={value} onChange={setValue} />;
}

describe("TimeField", () => {
  it("accepts a valid 12-hour time without an error", async () => {
    render(<Harness />);
    const field = screen.getByLabelText("Start time");
    await userEvent.type(field, "7:00 AM");
    await userEvent.tab();
    expect(screen.queryByText(ERROR)).not.toBeInTheDocument();
    expect(field).not.toHaveAttribute("aria-invalid");
  });

  it("shows a specific error for an invalid time after blur", async () => {
    render(<Harness />);
    const field = screen.getByLabelText("Start time");
    await userEvent.type(field, "25:00");
    await userEvent.tab();
    expect(screen.getByText(ERROR)).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("clears the error live once the value becomes valid", async () => {
    render(<Harness initial="99" />);
    const field = screen.getByLabelText("Start time");
    await userEvent.click(field);
    await userEvent.tab(); // blur -> touched, error shows
    expect(screen.getByText(ERROR)).toBeInTheDocument();
    await userEvent.clear(field);
    await userEvent.type(field, "2:30 PM");
    expect(screen.queryByText(ERROR)).not.toBeInTheDocument();
  });

  it("does not flag an empty field (required-ness is the form's job)", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText("Start time"));
    await userEvent.tab();
    expect(screen.queryByText(ERROR)).not.toBeInTheDocument();
  });

  it("prefers an external error over the internal one", async () => {
    render(
      <TimeField
        label="Start time"
        value="7:00 AM"
        onChange={() => {}}
        error="This shift overlaps with Maria's 2:00 PM – 6:00 PM shift"
      />
    );
    expect(
      screen.getByText(
        "This shift overlaps with Maria's 2:00 PM – 6:00 PM shift"
      )
    ).toBeInTheDocument();
  });
});
