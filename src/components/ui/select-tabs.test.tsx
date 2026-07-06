import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";

const POSITIONS = [
  { value: "line-cook", label: "Line cook" },
  { value: "server", label: "Server" },
];

describe("Select", () => {
  it("renders a native labelled select and reports the chosen value", async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Position"
        placeholder="Choose a position"
        options={POSITIONS}
        onChange={onChange}
      />
    );
    const select = screen.getByLabelText("Position");
    expect(select.tagName).toBe("SELECT");
    await userEvent.selectOptions(select, "server");
    expect(onChange).toHaveBeenCalledWith("server");
  });

  it("shows the placeholder when nothing is selected", () => {
    render(
      <Select label="Position" placeholder="Choose a position" options={POSITIONS} />
    );
    const select = screen.getByLabelText("Position") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(
      screen.getByRole("option", { name: "Choose a position", hidden: true })
    ).toBeInTheDocument();
  });

  it("reflects a controlled value", () => {
    render(
      <Select label="Position" value="line-cook" onChange={() => {}} options={POSITIONS} />
    );
    expect((screen.getByLabelText("Position") as HTMLSelectElement).value).toBe(
      "line-cook"
    );
  });
});

describe("Tabs", () => {
  const TABS = [
    { value: "week", label: "Week" },
    { value: "day", label: "Day" },
  ];

  it("renders real tab buttons and marks the active one", () => {
    render(<Tabs tabs={TABS} value="day" />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Day" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "Week" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("fires onChange with the tab value on click", async () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} value="week" onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "Day" }));
    expect(onChange).toHaveBeenCalledWith("day");
  });

  it("manages its own state when uncontrolled", async () => {
    render(<Tabs tabs={TABS} defaultValue="week" />);
    await userEvent.click(screen.getByRole("tab", { name: "Day" }));
    expect(screen.getByRole("tab", { name: "Day" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});
