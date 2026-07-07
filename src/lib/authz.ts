import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import type { EmployeeProfile, Location, Position, User } from "@/generated/prisma/client";

/** Cookie holding the manager's chosen location (set by the switcher). */
export const ACTIVE_LOCATION_COOKIE = "rh-active-location";

/** bcryptjs, 10 rounds (roadmap contract). */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, 10);
}

export async function verifyPassword(plain: string, hashValue: string): Promise<boolean> {
  return compare(plain, hashValue);
}

/**
 * Look a user up by phone-or-email identifier and verify their password.
 * Returns null on any miss — callers show one generic "doesn't match"
 * message and never reveal which part was wrong.
 */
export async function authenticateUser(identifier: string, password: string): Promise<User | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  let where: { email: string } | { phone: string };
  if (trimmed.includes("@")) {
    where = { email: trimmed.toLowerCase() };
  } else {
    const phone = normalizePhone(trimmed);
    if (!phone) return null;
    where = { phone };
  }

  const user = await prisma.user.findFirst({ where });
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? user : null;
}

/**
 * The manager's active location: the one named by the switcher cookie when
 * it belongs to their org, else the org's oldest location. Every manager
 * page and API guard resolves through here, so the switcher changes the
 * whole app's scope at once.
 */
export async function getManagerLocation(userId: string): Promise<Location> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(401, "unauthorized", "Your session is no longer valid. Please log in again.");
  }

  // cookies() throws outside a request scope (unit tests, scripts) — treat
  // that the same as no cookie. A cookie naming another org's location (or a
  // deleted one) is ignored, never trusted.
  let preferredId: string | null = null;
  try {
    preferredId = (await cookies()).get(ACTIVE_LOCATION_COOKIE)?.value ?? null;
  } catch {
    preferredId = null;
  }
  if (preferredId) {
    const preferred = await prisma.location.findFirst({
      where: { id: preferredId, organizationId: user.organizationId },
    });
    if (preferred) return preferred;
  }

  const location = await prisma.location.findFirst({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "asc" },
  });
  if (!location) {
    throw new ApiError(404, "no_location", "No location is set up for this business yet.");
  }
  return location;
}

export async function getEmployeeProfile(
  userId: string,
): Promise<EmployeeProfile & { location: Location; primaryPosition: Position | null }> {
  const profile = await prisma.employeeProfile.findFirst({
    where: { userId },
    include: { location: true, primaryPosition: true },
  });
  if (!profile) {
    throw new ApiError(404, "no_profile", "This account isn't linked to a team yet.");
  }
  return profile;
}

/**
 * Tenancy gate for API handlers. Passes when the user is a manager in the
 * location's organization, or holds an EmployeeProfile at the location.
 */
export async function assertLocationMember(userId: string, locationId: string): Promise<void> {
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    throw new ApiError(404, "location_not_found", "That location doesn't exist.");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(401, "unauthorized", "Your session is no longer valid. Please log in again.");
  }
  if (user.role === "manager" && user.organizationId === location.organizationId) return;

  const profile = await prisma.employeeProfile.findFirst({ where: { userId, locationId } });
  if (profile) return;

  throw new ApiError(403, "forbidden", "You don't have access to this location.");
}
