import { prisma } from "@/lib/db";

export type PositionRow = {
  id: string;
  name: string;
  sortOrder: number;
  archived: boolean;
};

/** Active positions (sortOrder asc) and archived positions (name asc). */
export async function getPositionsForSettings(
  locationId: string,
): Promise<{ active: PositionRow[]; archived: PositionRow[] }> {
  const rows = await prisma.position.findMany({
    where: { locationId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, sortOrder: true, archivedAt: true },
  });
  const active: PositionRow[] = [];
  const archived: PositionRow[] = [];
  for (const r of rows) {
    const row: PositionRow = {
      id: r.id,
      name: r.name,
      sortOrder: r.sortOrder,
      archived: r.archivedAt !== null,
    };
    if (r.archivedAt === null) active.push(row);
    else archived.push(row);
  }
  archived.sort((a, b) => a.name.localeCompare(b.name));
  return { active, archived };
}
