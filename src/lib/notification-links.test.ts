import { describe, expect, it } from "vitest";
import { notificationHref } from "./notification-links";

describe("notificationHref", () => {
  it("routes each notification type to its screen", () => {
    expect(notificationHref("schedule_published")).toBe("/shifts");
    expect(notificationHref("shift_reminder")).toBe("/shifts");
    expect(notificationHref("swap_approved")).toBe("/swaps");
    expect(notificationHref("swap_denied")).toBe("/swaps");
    expect(notificationHref("claim_approved")).toBe("/swaps");
    expect(notificationHref("claim_denied")).toBe("/swaps");
    expect(notificationHref("open_shift_posted")).toBe("/swaps");
    expect(notificationHref("timeoff_approved")).toBe("/availability");
    expect(notificationHref("timeoff_denied")).toBe("/availability");
  });

  it("falls back to the home screen for unknown types", () => {
    expect(notificationHref("something_new")).toBe("/shifts");
  });
});
