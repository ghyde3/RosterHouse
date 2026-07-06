import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Switch } from "@/components/ui/Switch";

describe("Input", () => {
  it("associates the label with the input", () => {
    render(<Input label="Phone or email" placeholder="maria@example.com" />);
    const input = screen.getByLabelText("Phone or email");
    expect(input).toHaveAttribute("placeholder", "maria@example.com");
  });

  it("shows an error line wired up with aria attributes", () => {
    render(<Input label="Password" error="Enter at least 8 characters" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter at least 8 characters")).toBeInTheDocument();
    expect(input).toHaveAccessibleDescription("Enter at least 8 characters");
  });

  it("passes value and onChange through to the native input", async () => {
    const onChange = vi.fn();
    render(<Input label="Name" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Name"), "M");
    expect(onChange).toHaveBeenCalled();
  });
});

describe("Checkbox", () => {
  it("is a real checkbox toggled by click, reporting a boolean", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Line cook" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Line cook" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("is keyboard operable with space", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Server" checked={true} onChange={onChange} />);
    screen.getByRole("checkbox", { name: "Server" }).focus();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does not fire when disabled", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Host" disabled onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Host" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Switch", () => {
  it("exposes role switch and toggles with a boolean", async () => {
    const onChange = vi.fn();
    render(
      <Switch label="Text message alerts" checked={false} onChange={onChange} />
    );
    const control = screen.getByRole("switch", { name: "Text message alerts" });
    expect(control).not.toBeChecked();
    await userEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
