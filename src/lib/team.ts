import { prisma } from "@/lib/db";

export type TeamMember = {
  id: string; // EmployeeProfile id
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: "invited" | "active" | "inactive";
  primaryPositionId: string | null;
  primaryPositionName: string | null;
  positionIds: string[];
  hourlyRate: number | null;
  vacationBalanceHours: number | null; // NULL = tracking off
  sickBalanceHours: number | null; // NULL = tracking off
};

export type PendingInvite = {
  id: string;
  name: string | null;
  contact: string;
  positionName: string | null;
  token: string;
  createdAt: string; // ISO
};

/** Serializable team list — shared by the team page and GET .../team. */
export async function getTeam(locationId: string): Promise<TeamMember[]> {
  const profiles = await prisma.employeeProfile.findMany({
    where: { locationId },
    include: { user: true, primaryPosition: true, positions: true },
    orderBy: { user: { name: "asc" } },
  });
  return profiles.map((p) => ({
    id: p.id,
    userId: p.userId,
    name: p.user.name,
    email: p.user.email,
    phone: p.user.phone,
    status: p.status,
    primaryPositionId: p.primaryPositionId,
    primaryPositionName: p.primaryPosition?.name ?? null,
    positionIds: p.positions.map((ep) => ep.positionId),
    hourlyRate: p.hourlyRate === null ? null : Number(p.hourlyRate),
    vacationBalanceHours: p.vacationBalanceHours === null ? null : Number(p.vacationBalanceHours),
    sickBalanceHours: p.sickBalanceHours === null ? null : Number(p.sickBalanceHours),
  }));
}

export async function getPendingInvites(locationId: string): Promise<PendingInvite[]> {
  const invites = await prisma.invite.findMany({
    where: { locationId, status: "pending" },
    include: { position: true },
    orderBy: { createdAt: "desc" },
  });
  const now = Date.now();
  return invites
    .filter((i) => i.expiresAt === null || i.expiresAt.getTime() > now)
    .map((i) => ({
      id: i.id,
      name: i.name,
      contact: i.email ?? i.phone ?? "",
      positionName: i.position?.name ?? null,
      token: i.token,
      createdAt: i.createdAt.toISOString(),
    }));
}
