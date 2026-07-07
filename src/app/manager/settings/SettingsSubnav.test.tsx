// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: pathnameMock }));

import { SettingsSubnav } from "@/app/manager/settings/SettingsSubnav";

afterEach(() => cleanup());

describe("SettingsSubnav", () => {
  it("renders Location, Positions, and Templates links", () => {
    pathnameMock.mockReturnValue("/manager/settings");
    render(<SettingsSubnav />);
    expect(screen.getByRole("link", { name: "Location" })).toHaveAttribute("href", "/manager/settings");
    expect(screen.getByRole("link", { name: "Positions" })).toHaveAttribute(
      "href",
      "/manager/settings/positions",
    );
    expect(screen.getByRole("link", { name: "Templates" })).toHaveAttribute(
      "href",
      "/manager/settings/templates",
    );
  });

  it("marks Location active only on the exact settings root", () => {
    pathnameMock.mockReturnValue("/manager/settings");
    render(<SettingsSubnav />);
    expect(screen.getByRole("link", { name: "Location" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Templates" })).not.toHaveAttribute("aria-current");
  });

  it("marks Templates active on a templates sub-route", () => {
    pathnameMock.mockReturnValue("/manager/settings/templates/abc");
    render(<SettingsSubnav />);
    expect(screen.getByRole("link", { name: "Templates" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Location" })).not.toHaveAttribute("aria-current");
  });
});
