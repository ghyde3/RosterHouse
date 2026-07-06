import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("renders a real button element with variant and size data attributes", () => {
    render(
      <Button variant="danger" size="lg">
        Delete shift
      </Button>
    );
    const button = screen.getByRole("button", { name: "Delete shift" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("data-variant", "danger");
    expect(button).toHaveAttribute("data-size", "lg");
    expect(button).toHaveAttribute("type", "button");
  });

  it("defaults to primary / md", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("data-variant", "primary");
    expect(button).toHaveAttribute("data-size", "md");
  });

  it("merges caller className and style instead of dropping them", () => {
    render(
      <Button className="my-extra" style={{ marginTop: 8 }}>
        Save
      </Button>
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.className).toContain("my-extra");
    expect(button.className).toContain("button"); // module class kept too
    expect(button).toHaveStyle({ marginTop: "8px" });
  });

  it("fires onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Publish schedule</Button>);
    await userEvent.click(
      screen.getByRole("button", { name: "Publish schedule" })
    );
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Publish schedule
      </Button>
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Publish schedule" })
    );
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards refs to the underlying button (React 19 ref prop)", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Save</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("renders a leading icon before the label", () => {
    render(<Button icon={<svg data-testid="lead-icon" />}>Add shift</Button>);
    const button = screen.getByRole("button", { name: "Add shift" });
    expect(button.firstChild).toBe(screen.getByTestId("lead-icon"));
  });
});
