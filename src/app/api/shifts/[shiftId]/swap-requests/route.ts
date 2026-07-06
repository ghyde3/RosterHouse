import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getEmployeeProfile } from "@/lib/authz";

const createSwapSchema = z.object({
  coveringEmployeeProfileId: z.string().min(1).nullable(),
  note: z.string().trim().max(500).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ shiftId: string }> }) {
  const { shiftId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = createSwapSchema.safeParse(body);
  if (!parsed.success) return jsonErr("invalid_input", "Check the swap details and try again.", 400);

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
  if (shift.employeeProfileId !== profile.id) {
    return jsonErr("forbidden", "You can only request a swap for your own shifts.", 403);
  }
  if (shift.status !== "published") return jsonErr("not_published", "This shift isn't published yet.", 409);
  if (shift.startsAt <= new Date()) {
    return jsonErr("shift_started", "This shift already started, so it can't be swapped.", 409);
  }

  const existing = await prisma.swapRequest.findFirst({ where: { shiftId, status: "pending" } });
  if (existing) {
    return jsonErr("duplicate_request", "There's already a pending swap request for this shift.", 409);
  }

  const covererId = parsed.data.coveringEmployeeProfileId;
  if (covererId) {
    if (covererId === profile.id) {
      return jsonErr("invalid_coverer", "You can't cover your own shift — pick a teammate.", 400);
    }
    const coverer = await prisma.employeeProfile.findUnique({
      where: { id: covererId },
      include: { user: true, positions: true },
    });
    if (!coverer || coverer.locationId !== shift.locationId || coverer.status !== "active") {
      return jsonErr("invalid_coverer", "That teammate isn't available at your location.", 400);
    }
    if (!coverer.positions.some((p) => p.positionId === shift.positionId)) {
      return jsonErr("not_qualified", `${coverer.user.name} isn't qualified for ${shift.position.name} shifts.`, 400);
    }
  }

  const created = await prisma.swapRequest.create({
    data: {
      shiftId,
      requestingEmployeeProfileId: profile.id,
      coveringEmployeeProfileId: covererId,
      note: parsed.data.note || null,
    },
  });
  return jsonOk({ id: created.id, status: created.status });
}
