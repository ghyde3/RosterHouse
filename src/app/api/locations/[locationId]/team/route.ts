import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { assertLocationMember } from "@/lib/authz";
import { getTeam } from "@/lib/team";

export async function GET(_req: Request, { params }: { params: Promise<{ locationId: string }> }) {
  try {
    const { locationId } = await params;
    const user = await apiUser();
    if (!user) return jsonErr("unauthorized", "You need to log in to do that.", 401);
    if (user.role !== "manager") return jsonErr("forbidden", "Only managers can view the team list.", 403);
    await assertLocationMember(user.id, locationId);

    const members = await getTeam(locationId);
    return jsonOk({ members });
  } catch (err) {
    return handleApiError(err);
  }
}
