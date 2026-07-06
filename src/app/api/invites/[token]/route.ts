import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { getInviteByToken } from "@/lib/invites";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const invite = await getInviteByToken(token);
    if (!invite) return jsonErr("invite_not_found", "That invite link isn't valid.", 404);
    if (invite.status === "accepted") {
      return jsonErr("invite_used", "That invite has already been used. Try logging in instead.", 410);
    }
    if (invite.status === "expired") {
      return jsonErr("invite_expired", "That invite has expired. Ask your manager to send a new one.", 410);
    }
    return jsonOk(invite);
  } catch (err) {
    return handleApiError(err);
  }
}
