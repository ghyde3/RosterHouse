import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk, parseJson } from "@/lib/api";
import { getEmployeeContext } from "@/lib/queries/employee";

const bodySchema = z
  .object({
    notifyPush: z.boolean().optional(),
    notifySms: z.boolean().optional(),
    notifyEmail: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, {
    message: "Provide at least one preference to update.",
  });

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  const parsed = await parseJson(request, bodySchema);
  if (parsed.error) return parsed.error;

  const ctx = await getEmployeeContext(session.user.id);
  if (!ctx) return jsonErr("no_profile", "No employee profile is linked to this account.", 403);

  const updated = await prisma.employeeProfile.update({
    where: { id: ctx.profileId },
    data: parsed.data,
    select: { notifyPush: true, notifySms: true, notifyEmail: true },
  });
  return jsonOk(updated);
}
