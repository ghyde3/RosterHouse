import { afterEach, describe, expect, it } from "vitest";
import { deepLinkFor, smsBodyFor } from "@/lib/notify/templates";

afterEach(() => {
  delete process.env.APP_URL;
});

describe("deepLinkFor", () => {
  it("maps every notification type to an employee-app path", () => {
    expect(deepLinkFor("schedule_published")).toBe("http://localhost:3000/shifts");
    expect(deepLinkFor("shift_reminder")).toBe("http://localhost:3000/shifts");
    expect(deepLinkFor("swap_approved")).toBe("http://localhost:3000/swaps");
    expect(deepLinkFor("swap_denied")).toBe("http://localhost:3000/swaps");
    expect(deepLinkFor("claim_approved")).toBe("http://localhost:3000/swaps");
    expect(deepLinkFor("claim_denied")).toBe("http://localhost:3000/swaps");
    expect(deepLinkFor("open_shift_posted")).toBe("http://localhost:3000/swaps");
    expect(deepLinkFor("timeoff_approved")).toBe("http://localhost:3000/availability");
    expect(deepLinkFor("timeoff_denied")).toBe("http://localhost:3000/availability");
  });

  it("respects APP_URL", () => {
    process.env.APP_URL = "https://rosterhouse.example.com";
    expect(deepLinkFor("swap_approved")).toBe("https://rosterhouse.example.com/swaps");
  });
});

describe("smsBodyFor", () => {
  it("composes a calm sentence-case body with the deep link", () => {
    expect(
      smsBodyFor({
        type: "swap_approved",
        title: "Swap approved",
        body: "Ben Cho will cover your Sat Jul 12 Server shift, 4:00 PM – 10:00 PM.",
      }),
    ).toBe(
      "RosterHouse: Swap approved. Ben Cho will cover your Sat Jul 12 Server shift, 4:00 PM – 10:00 PM. http://localhost:3000/swaps",
    );
  });
});
