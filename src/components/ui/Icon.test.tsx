import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Icon } from "@/components/ui/Icon";

describe("Icon", () => {
  it("renders the named lucide icon as an svg", () => {
    const { container } = render(<Icon name="calendar" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("defaults to size 18 and stroke width 1.75", () => {
    const { container } = render(<Icon name="alert-triangle" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "18");
    expect(svg).toHaveAttribute("stroke-width", "1.75");
  });

  it("accepts size and strokeWidth overrides and is decorative by default", () => {
    const { container } = render(
      <Icon name="check" size={12} strokeWidth={3} />
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "12");
    expect(svg).toHaveAttribute("stroke-width", "3");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
