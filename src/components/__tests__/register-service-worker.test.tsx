/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";

afterEach(() => {
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
});

function stubServiceWorker(register: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register },
  });
}

describe("RegisterServiceWorker", () => {
  it("registers /sw.js with root scope and no update caching", async () => {
    const register = vi.fn().mockResolvedValue({});
    stubServiceWorker(register);

    render(<RegisterServiceWorker />);

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  });

  it("renders nothing and does not crash when service workers are unsupported", () => {
    // jsdom has no navigator.serviceWorker by default.
    const { container } = render(<RegisterServiceWorker />);
    expect(container.innerHTML).toBe("");
  });

  it("swallows registration failures", async () => {
    const register = vi.fn().mockRejectedValue(new Error("nope"));
    stubServiceWorker(register);

    render(<RegisterServiceWorker />);

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    // Flush the rejected promise chain; an unhandled rejection would fail
    // the test run.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
