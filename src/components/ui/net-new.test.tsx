import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Textarea } from "@/components/ui/Textarea";
import { Avatar } from "@/components/ui/Avatar";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";

describe("Textarea", () => {
  it("associates the label and defaults to 3 rows", () => {
    render(<Textarea label="Shift notes" />);
    const area = screen.getByLabelText("Shift notes");
    expect(area.tagName).toBe("TEXTAREA");
    expect(area).toHaveAttribute("rows", "3");
  });

  it("wires an error with aria attributes", () => {
    render(<Textarea label="Note" error="Add a short note for your manager" />);
    const area = screen.getByLabelText("Note");
    expect(area).toHaveAttribute("aria-invalid", "true");
    expect(area).toHaveAccessibleDescription(
      "Add a short note for your manager"
    );
  });
});

describe("Avatar", () => {
  it("renders initials without a status dot", () => {
    const { container } = render(<Avatar name="Maria Garcia" />);
    expect(screen.getByText("MG")).toBeInTheDocument();
    expect(container.querySelectorAll("span span").length).toBe(0);
  });
});

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Coverage gaps this week" value="2" />);
    expect(screen.getByText("Coverage gaps this week")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("applies the tone color to the value", () => {
    render(
      <StatCard
        label="Clocked in now"
        value="4"
        tone="var(--status-success)"
      />
    );
    expect(screen.getByText("4")).toHaveStyle({
      color: "var(--status-success)",
    });
  });
});

describe("EmptyState", () => {
  it("renders title, description, and action", () => {
    render(
      <EmptyState
        title="No shifts this week"
        description="Add a shift to get started."
        action={<button type="button">Add shift</button>}
      />
    );
    expect(screen.getByText("No shifts this week")).toBeInTheDocument();
    expect(screen.getByText("Add a shift to get started.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add shift" })
    ).toBeInTheDocument();
  });
});

describe("Spinner", () => {
  it("announces loading via role status with an sr-only label", () => {
    render(<Spinner />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading…");
  });

  it("accepts a custom label", () => {
    render(<Spinner label="Publishing schedule…" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Publishing schedule…"
    );
  });
});
