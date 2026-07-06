import "dotenv/config"; // defensive: @/lib/db builds the Prisma client from DATABASE_URL at import time
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getDashboardData } from "@/lib/dashboard-data";

let locationId: string;
let timezone: string;

beforeAll(async () => {
  const jamie = await prisma.user.findUnique({ where: { email: "jamie@harborvine.test" } });
  if (!jamie) throw new Error("Seed data missing. Run: npx prisma db seed");
  const location = await prisma.location.findFirstOrThrow({
    where: { organizationId: jamie.organizationId },
  });
  locationId = location.id;
  timezone = location.timezone;
});

describe("getDashboardData", () => {
  // Seed guarantees exactly one pending time-off, one pending swap, one
  // pending claim. If these fail after manual app use, reset with
  // `npx prisma migrate reset --force`.
  it("counts pending requests from the seed", async () => {
    const data = await getDashboardData(locationId, timezone);
    expect(data.pendingTimeOff).toBe(1);
    expect(data.pendingSwaps).toBe(1);
    expect(data.pendingClaims).toBe(1);
    expect(data.pendingRequests).toBe(3);
  });

  it("computes week-scoped aggregates with valid shapes", async () => {
    const data = await getDashboardData(locationId, timezone);
    expect(data.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.openShiftsThisWeek).toBeGreaterThanOrEqual(0);
    expect(data.conflictCountThisWeek).toBeGreaterThanOrEqual(0);
    // "$4,120"-style, "$0", or an em dash when any rate is missing
    expect(data.projectedLaborCost).toMatch(/^(\$[\d,]+|—)$/);
    expect(Array.isArray(data.clockedInNow)).toBe(true); // seed has no open clock entries
  });
});
