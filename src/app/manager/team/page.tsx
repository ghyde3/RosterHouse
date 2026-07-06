import type { Metadata } from "next";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { getPendingInvites, getTeam } from "@/lib/team";
import { TeamView } from "./TeamView";

export const metadata: Metadata = { title: "Team — RosterHouse" };

export default async function TeamPage() {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);

  const [members, pendingInvites, positions] = await Promise.all([
    getTeam(location.id),
    getPendingInvites(location.id),
    prisma.position.findMany({ where: { locationId: location.id }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <TeamView
      locationId={location.id}
      members={members}
      pendingInvites={pendingInvites}
      positions={positions.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
