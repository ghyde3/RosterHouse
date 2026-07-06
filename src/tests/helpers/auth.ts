// Usage: the TEST FILE must declare this hoisted mock BEFORE its imports run:
//
//   vi.mock("@/lib/auth", () => ({
//     auth: vi.fn(),
//     requireUser: vi.fn(),
//     requireManager: vi.fn(),
//     signIn: vi.fn(),
//     signOut: vi.fn(),
//     handlers: {},
//   }));
//
// Then call signInAs(...) inside the test to choose the session user.
import { vi } from "vitest";
import { auth } from "@/lib/auth";

export function signInAs(
  userId: string,
  opts: { role: "manager" | "employee"; organizationId: string; name?: string },
): void {
  vi.mocked(auth).mockResolvedValue({
    user: { id: userId, name: opts.name ?? "Test User", role: opts.role, organizationId: opts.organizationId },
  } as never);
}

export function signOutAll(): void {
  vi.mocked(auth).mockResolvedValue(null as never);
}
