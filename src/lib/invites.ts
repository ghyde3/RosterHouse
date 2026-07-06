import { prisma } from "@/lib/db";

export type ResolvedInvite = {
  token: string;
  locationName: string;
  organizationName: string;
  inviterName: string;
  positionName: string | null;
  inviteeName: string | null;
  status: "pending" | "accepted" | "expired";
};

/** Shared by GET /api/invites/[token] and the /invite/[token] page. */
export async function getInviteByToken(token: string): Promise<ResolvedInvite | null> {
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: {
      location: { include: { organization: true } },
      invitedBy: true,
      position: true,
    },
  });
  if (!invite) return null;

  const expired =
    invite.status === "expired" || (invite.expiresAt !== null && invite.expiresAt.getTime() < Date.now());

  return {
    token: invite.token,
    locationName: invite.location.name,
    organizationName: invite.location.organization.name,
    inviterName: invite.invitedBy.name,
    positionName: invite.position?.name ?? null,
    inviteeName: invite.name,
    status: invite.status === "accepted" ? "accepted" : expired ? "expired" : "pending",
  };
}
