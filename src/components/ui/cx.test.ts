import { describe, expect, it } from "vitest";
import { cx } from "@/components/ui/cx";

describe("cx", () => {
  it("joins truthy class parts with spaces", () => {
    expect(cx("a", "b")).toBe("a b");
  });

  it("drops false, null, and undefined parts", () => {
    expect(cx("a", false, null, undefined, "b")).toBe("a b");
  });

  it("returns an empty string for no parts", () => {
    expect(cx()).toBe("");
  });
});
