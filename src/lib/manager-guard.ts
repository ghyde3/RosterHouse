import type { Location } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";

export type ManagerGuard =
  | { ok: true; userId: string; location: Location }
  | { ok: false; status: number; code: string; message: string };

/**
 * API-side manager check. Unlike requireManager() (which redirects, for
 * pages), this returns a result the route handler turns into jsonErr.
 *
 * Callers must wrap the call site in try/catch (or rely on the route's
 * top-level try/catch + handleApiError) because getManagerLocation() throws
 * ApiError when the org has no location set up yet.
 */
export async function requireManagerForApi(): Promise<ManagerGuard> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, status: 401, code: "unauthorized", message: "Sign in to continue" };
  }
  if (session.user.role !== "manager") {
    return { ok: false, status: 403, code: "forbidden", message: "Only managers can manage schedules" };
  }
  const location = await getManagerLocation(session.user.id);
  return { ok: true, userId: session.user.id, location };
}
