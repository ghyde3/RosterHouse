import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Case-insensitive name uniqueness for ACTIVE positions, mirroring the
 * signup dedup (src/app/api/auth/signup/route.ts). Tighter than the DB's
 * case-sensitive @@unique([locationId, name]). Archived positions are
 * ignored: archiving frees the name for new scheduling.
 */
export async function assertNameAvailable(
  locationId: string,
  name: string,
  opts: { excludeId?: string } = {},
): Promise<void> {
  const target = name.trim().toLowerCase();
  const actives = await prisma.position.findMany({
    where: { locationId, archivedAt: null },
    select: { id: true, name: true },
  });
  const clash = actives.some(
    (p) => p.id !== opts.excludeId && p.name.trim().toLowerCase() === target,
  );
  if (clash) {
    throw new ApiError(409, "name_taken", "A position with that name already exists");
  }
}

/** Next dense sortOrder = max(active sortOrder) + 1, or 0 when there are none. */
export async function nextSortOrder(locationId: string): Promise<number> {
  const top = await prisma.position.findFirst({
    where: { locationId, archivedAt: null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return top ? top.sortOrder + 1 : 0;
}
