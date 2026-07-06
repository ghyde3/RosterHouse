import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  TOAST_DURATION_MS,
  TOAST_EXIT_MS,
  ToasterProvider,
  useToast,
} from "@/components/ui/Toaster";

function Trigger() {
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        toast({
          title: "Schedule published",
          description: "12 employees notified.",
          tone: "success",
        })
      }
    >
      Fire toast
    </button>
  );
}

describe("Toaster", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a toast when toast() is called", () => {
    render(
      <ToasterProvider>
        <Trigger />
      </ToasterProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Fire toast" }));
    expect(screen.getByText("Schedule published")).toBeInTheDocument();
    expect(screen.getByText("12 employees notified.")).toBeInTheDocument();
  });

  it("queues multiple toasts at once", () => {
    render(
      <ToasterProvider>
        <Trigger />
      </ToasterProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Fire toast" }));
    fireEvent.click(screen.getByRole("button", { name: "Fire toast" }));
    expect(screen.getAllByText("Schedule published")).toHaveLength(2);
  });

  it("auto-dismisses after 3.5 s plus the exit animation", () => {
    render(
      <ToasterProvider>
        <Trigger />
      </ToasterProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Fire toast" }));
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    });
    expect(screen.getByText("Schedule published")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    // exit has begun; toast stays mounted for the animation
    expect(screen.getByText("Schedule published")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS);
    });
    expect(screen.queryByText("Schedule published")).not.toBeInTheDocument();
  });

  it("dismisses early from the toast's Dismiss button", () => {
    render(
      <ToasterProvider>
        <Trigger />
      </ToasterProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Fire toast" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS);
    });
    expect(screen.queryByText("Schedule published")).not.toBeInTheDocument();
  });

  it("throws a helpful error when useToast is used unwrapped", () => {
    function Naked() {
      useToast();
      return null;
    }
    expect(() => render(<Naked />)).toThrow(
      "useToast must be used inside <ToasterProvider>"
    );
  });
});
