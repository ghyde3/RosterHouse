import { auth } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/api";
import { getMe } from "@/lib/queries/employee";

export async function GET() {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);
  const me = await getMe(session.user.id);
  if (!me) return jsonErr("unauthorized", "You need to sign in.", 401);
  return jsonOk(me);
}
