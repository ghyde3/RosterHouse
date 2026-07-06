import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toast } from "@/components/ui/Toast";

describe("Toast", () => {
  it("renders title and description in a status region", () => {
    render(
      <Toast
        tone="success"
        title="Schedule published"
        description="12 employees notified."
      />
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Schedule published");
    expect(status).toHaveTextContent("12 employees notified.");
    expect(status).toHaveAttribute("data-tone", "success");
  });

  it.each([
    ["success", "check"],
    // The installed lucide-react version renders AlertTriangle's class as
    // "lucide-triangle-alert" rather than "lucide-alert-triangle".
    ["warning", "triangle-alert"],
    ["danger", "x"],
    ["info", "bell"],
  ] as const)("uses a %s-specific icon (%s)", (tone, iconName) => {
    render(<Toast tone={tone} title="Heads up" />);
    // Icon components render the lucide name as a class, e.g. "lucide-check"
    const svg = screen.getByRole("status").querySelector("svg");
    expect(svg?.getAttribute("class") ?? "").toContain(iconName);
  });

  it("fires onClose from a real Dismiss button", async () => {
    const onClose = vi.fn();
    render(<Toast title="Shift updated" onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders no close button without onClose", () => {
    render(<Toast title="Shift updated" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
