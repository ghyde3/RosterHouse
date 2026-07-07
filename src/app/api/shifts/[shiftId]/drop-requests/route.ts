import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getEmployeeProfile } from "@/lib/authz";

const createDropSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ shiftId: string }> }) {
  const { shiftId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = createDropSchema.safeParse(body);
  if (!parsed.success) return jsonErr("invalid_input", "Check the drop details and try again.", 400);

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);

  let profile;
  try {
    profile = await getEmployeeProfile(user.id);
  } catch {
    return jsonErr("no_profile", "We couldn't find an employee profile for your account.", 403);
  }

  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) return jsonErr("not_found", "This shift no longer exists.", 404);
  if (shift.employeeProfileId !== profile.id) {
    return jsonErr("forbidden", "You can only ask to drop your own shifts.", 403);
  }
  if (shift.status !== "published") return jsonErr("not_published", "This shift isn't published yet.", 409);
  if (shift.startsAt <= new Date()) {
    return jsonErr("shift_started", "This shift already started, so it can't be dropped.", 409);
  }

  const existing = await prisma.dropRequest.findFirst({
    where: { shiftId, requestingEmployeeProfileId: profile.id, status: "pending" },
  });
  if (existing) {
    return jsonErr("duplicate_request", "You already asked to drop this shift.", 409);
  }

  const created = await prisma.dropRequest.create({
    data: {
      shiftId,
      requestingEmployeeProfileId: profile.id,
      note: parsed.data.note || null,
    },
  });
  return jsonOk({ id: created.id, status: created.status });
}
