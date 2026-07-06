import type { Metadata } from "next";
import Link from "next/link";
import { getInviteByToken } from "@/lib/invites";
import { AcceptInviteForm } from "./AcceptInviteForm";

export const metadata: Metadata = { title: "Accept invite — RosterHouse" };

function InviteProblem({ title, description }: { title: string; description: string }) {
  return (
    <main
      style={{
        maxWidth: 480,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "72px 24px 24px",
      }}
    >
      <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", color: "var(--text-primary)" }}>
        {title}
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{description}</p>
      <Link href="/login" style={{ fontSize: 14, color: "var(--text-brand)", fontWeight: 600 }}>
        Go to log in
      </Link>
    </main>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    return (
      <InviteProblem
        title="This invite link isn't valid"
        description="Check that you copied the whole link from your message, or ask your manager to send a new one."
      />
    );
  }
  if (invite.status === "accepted") {
    return (
      <InviteProblem
        title="This invite was already used"
        description="If that was you, log in with your phone number and password."
      />
    );
  }
  if (invite.status === "expired") {
    return <InviteProblem title="This invite has expired" description="Ask your manager to send a new one." />;
  }

  return (
    <AcceptInviteForm
      token={invite.token}
      inviterName={invite.inviterName}
      locationName={invite.locationName}
      positionName={invite.positionName}
      defaultName={invite.inviteeName ?? ""}
    />
  );
}
