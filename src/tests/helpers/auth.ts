// Usage: the TEST FILE must declare this hoisted mock BEFORE its imports run:
//
//   vi.mock("@/lib/auth", () => ({
//     auth: vi.fn(),
//     requireUser: vi.fn(),
//     requireManager: vi.fn(),
//     apiUser: vi.fn(),
//     signIn: vi.fn(),
//     signOut: vi.fn(),
//     handlers: {},
//   }));
//
// Then call signInAs(...) inside the test to choose the session user. It sets
// both `auth()` (used by requireUser/requireManager) and `apiUser()` (the
// canonical API-route auth entrypoint, per AGENTS.md) so route handlers under
// test — most of which call `apiUser()` directly — see the signed-in session.
import { vi } from "vitest";
import { apiUser, auth } from "@/lib/auth";

export function signInAs(
  userId: string,
  opts: { role: "manager" | "employee"; organizationId: string; name?: string },
): void {
  const sessionUser = {
    id: userId,
    name: opts.name ?? "Test User",
    role: opts.role,
    organizationId: opts.organizationId,
  };
  vi.mocked(auth).mockResolvedValue({ user: sessionUser } as never);
  vi.mocked(apiUser).mockResolvedValue(sessionUser as never);
}

export function signOutAll(): void {
  vi.mocked(auth).mockResolvedValue(null as never);
  vi.mocked(apiUser).mockResolvedValue(null as never);
}
