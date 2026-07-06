// No request body — the shift id in the path is the whole input.
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getEmployeeProfile } from "@/lib/authz";

export async function POST(_req: Request, ctx: { params: Promise<{ shiftId: string }> }) {
  const { shiftId } = await ctx.params;
  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);

  let profile;
  try {
    profile = await getEmployeeProfile(user.id);
  } catch {
    return jsonErr("no_profile", "We couldn't find an employee profile for your account.", 403);
  }

  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, include: { position: true } });
  if (!shift) return jsonErr("not_found", "This shift no longer exists.", 404);
  if (shift.locationId !== profile.locationId) return jsonErr("forbidden", "This shift isn't at your location.", 403);
  if (shift.employeeProfileId !== null) return jsonErr("already_filled", "This shift was already filled.", 409);
  if (shift.status !== "published") return jsonErr("not_published", "This shift isn't published yet.", 409);
  if (shift.startsAt <= new Date()) return jsonErr("shift_started", "This shift already started.", 409);

  const qualification = await prisma.employeePosition.findUnique({
    where: { employeeProfileId_positionId: { employeeProfileId: profile.id, positionId: shift.positionId } },
  });
  if (!qualification) {
    return jsonErr(
      "not_qualified",
      `Ask your manager to add the ${shift.position.name} position to your profile before claiming this shift.`,
      403,
    );
  }

  const existing = await prisma.openShiftClaim.findUnique({
    where: { shiftId_employeeProfileId: { shiftId, employeeProfileId: profile.id } },
  });
  if (existing) return jsonErr("duplicate_claim", "You already requested this shift.", 409);

  const created = await prisma.openShiftClaim.create({
    data: { shiftId, employeeProfileId: profile.id },
  });
  return jsonOk({ id: created.id, status: created.status });
}
