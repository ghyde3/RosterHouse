import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getEmployeeProfile } from "@/lib/authz";
import { getTimeClockState } from "@/lib/timeclock";

export async function GET() {
  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);
  let profileId: string;
  try {
    profileId = (await getEmployeeProfile(user.id)).id;
  } catch {
    return jsonErr("no_profile", "We couldn't find an employee profile for your account.", 403);
  }
  return jsonOk(await getTimeClockState(profileId));
}
