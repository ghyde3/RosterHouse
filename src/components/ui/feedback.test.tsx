import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge } from "@/components/ui/Badge";
import { Tag } from "@/components/ui/Tag";
import { Tooltip } from "@/components/ui/Tooltip";

describe("Badge", () => {
  it("renders children with a tone data attribute", () => {
    render(<Badge tone="warning">Pending</Badge>);
    const badge = screen.getByText("Pending");
    expect(badge).toHaveAttribute("data-tone", "warning");
  });

  it("defaults to the success tone and merges className", () => {
    render(<Badge className="extra">Confirmed</Badge>);
    const badge = screen.getByText("Confirmed");
    expect(badge).toHaveAttribute("data-tone", "success");
    expect(badge.className).toContain("extra");
  });
});

describe("Tag", () => {
  it("renders a real remove button that fires onRemove", async () => {
    const onRemove = vi.fn();
    render(<Tag onRemove={onRemove}>Line cook</Tag>);
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("renders no button without onRemove", () => {
    render(<Tag>Server</Tag>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Tooltip", () => {
  it("renders the label in a tooltip role attached to the trigger", () => {
    render(
      <Tooltip label="Add shift">
        <button type="button">Plus</button>
      </Tooltip>
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent("Add shift");
  });
});
