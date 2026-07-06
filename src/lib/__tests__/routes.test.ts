import { describe, it, expect } from "vitest";
import { isEmployeePath, isPublicPath, redirectTargetFor } from "@/lib/routes";

const manager = { role: "manager" as const };
const employee = { role: "employee" as const };

describe("isPublicPath", () => {
  it("allows the marketing page, auth pages, and invite links", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/signup")).toBe(true);
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/invite/some-token-123")).toBe(true);
    expect(isPublicPath("/design-system")).toBe(true);
    expect(isPublicPath("/signout-stale")).toBe(true);
  });

  it("does not allow app pages", () => {
    expect(isPublicPath("/shifts")).toBe(false);
    expect(isPublicPath("/manager")).toBe(false);
    expect(isPublicPath("/manager/team")).toBe(false);
  });
});

describe("isEmployeePath", () => {
  it("matches the employee tab routes", () => {
    expect(isEmployeePath("/shifts")).toBe(true);
    expect(isEmployeePath("/shifts/abc")).toBe(true);
    expect(isEmployeePath("/availability")).toBe(true);
    expect(isEmployeePath("/clock")).toBe(true);
    expect(isEmployeePath("/swaps")).toBe(true);
    expect(isEmployeePath("/notifications")).toBe(true);
    expect(isEmployeePath("/profile")).toBe(true);
  });

  it("does not match the marketing page or manager routes, even overlapping names", () => {
    expect(isEmployeePath("/")).toBe(false);
    expect(isEmployeePath("/manager")).toBe(false);
    expect(isEmployeePath("/manager/availability")).toBe(false);
    expect(isEmployeePath("/manager/swaps")).toBe(false);
  });
});

describe("redirectTargetFor", () => {
  it("sends unauthenticated users to /login except on public paths", () => {
    expect(redirectTargetFor("/manager", null)).toBe("/login");
    expect(redirectTargetFor("/shifts", null)).toBe("/login");
    expect(redirectTargetFor("/", null)).toBeNull();
    expect(redirectTargetFor("/login", null)).toBeNull();
    expect(redirectTargetFor("/invite/tok", null)).toBeNull();
  });

  it("redirects signed-in users from the marketing page to their home", () => {
    expect(redirectTargetFor("/", manager)).toBe("/manager");
    expect(redirectTargetFor("/", employee)).toBe("/shifts");
  });

  it("sends employees at /manager/* to /shifts", () => {
    expect(redirectTargetFor("/manager", employee)).toBe("/shifts");
    expect(redirectTargetFor("/manager/schedule", employee)).toBe("/shifts");
  });

  it("sends managers at employee tabs to /manager", () => {
    expect(redirectTargetFor("/shifts", manager)).toBe("/manager");
    expect(redirectTargetFor("/clock", manager)).toBe("/manager");
    expect(redirectTargetFor("/shifts/abc", manager)).toBe("/manager");
  });

  it("leaves users alone on their own turf", () => {
    expect(redirectTargetFor("/manager/team", manager)).toBeNull();
    expect(redirectTargetFor("/manager/availability", manager)).toBeNull();
    expect(redirectTargetFor("/availability", employee)).toBeNull();
    expect(redirectTargetFor("/shifts", employee)).toBeNull();
  });

  it("bounces signed-in users off /login and /signup to their home", () => {
    expect(redirectTargetFor("/login", manager)).toBe("/manager");
    expect(redirectTargetFor("/login", employee)).toBe("/shifts");
    expect(redirectTargetFor("/signup", manager)).toBe("/manager");
  });
});
