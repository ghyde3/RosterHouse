// POST /api/me/calendar-token — mint a fresh calendar feed token for the
// caller's employee profile. Regenerating invalidates the previous URL.
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { getEmployeeContext } from "@/lib/queries/employee";

export async function POST() {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  const ctx = await getEmployeeContext(session.user.id);
  if (!ctx) return jsonErr("no_profile", "No employee profile is linked to this account.", 403);

  const token = randomUUID();
  await prisma.employeeProfile.update({
    where: { id: ctx.profileId },
    data: { calendarToken: token },
  });
  return jsonOk({ token });
}
