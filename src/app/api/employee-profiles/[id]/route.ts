import { z } from "zod";
import { handleApiError, jsonErr, jsonOk, parseJson } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { assertLocationMember } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { getTeam } from "@/lib/team";
import { Prisma } from "@/generated/prisma/client";

const patchSchema = z.object({
  primaryPositionId: z.string().nullable().optional(),
  positionIds: z.array(z.string()).optional(),
  hourlyRate: z.number().min(0, "Hourly rate can't be negative.").nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await apiUser();
    if (!user) return jsonErr("unauthorized", "You need to log in to do that.", 401);
    if (user.role !== "manager") return jsonErr("forbidden", "Only managers can edit team members.", 403);

    const profile = await prisma.employeeProfile.findUnique({ where: { id } });
    if (!profile) return jsonErr("profile_not_found", "That team member doesn't exist.", 404);
    await assertLocationMember(user.id, profile.locationId);

    const parsed = await parseJson(req, patchSchema);
    if (parsed.error) return parsed.error;
    const input = parsed.data;

    // Every referenced position must belong to this member's location.
    const idsToCheck = new Set<string>([
      ...(input.positionIds ?? []),
      ...(input.primaryPositionId ? [input.primaryPositionId] : []),
    ]);
    if (idsToCheck.size > 0) {
      const count = await prisma.position.count({
        where: { id: { in: [...idsToCheck] }, locationId: profile.locationId },
      });
      if (count !== idsToCheck.size) {
        return jsonErr("position_not_found", "One of those positions doesn't exist at this location.", 400);
      }
    }

    // The primary position is always part of the qualified list.
    const effectivePrimary =
      input.primaryPositionId === undefined ? profile.primaryPositionId : input.primaryPositionId;
    let effectivePositions = input.positionIds;
    if (effectivePositions && effectivePrimary && !effectivePositions.includes(effectivePrimary)) {
      effectivePositions = [...effectivePositions, effectivePrimary];
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeProfile.update({
        where: { id },
        data: {
          ...(input.primaryPositionId !== undefined ? { primaryPositionId: input.primaryPositionId } : {}),
          ...(input.hourlyRate !== undefined ? { hourlyRate: input.hourlyRate } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });
      if (effectivePositions) {
        await tx.employeePosition.deleteMany({ where: { employeeProfileId: id } });
        await tx.employeePosition.createMany({
          data: effectivePositions.map((positionId) => ({ employeeProfileId: id, positionId })),
        });
      } else if (input.primaryPositionId) {
        // Primary changed without an explicit list — make sure it's qualified.
        await tx.employeePosition.upsert({
          where: { employeeProfileId_positionId: { employeeProfileId: id, positionId: input.primaryPositionId } },
          update: {},
          create: { employeeProfileId: id, positionId: input.primaryPositionId },
        });
      }
    });

    const members = await getTeam(profile.locationId);
    const member = members.find((m) => m.id === id);
    return jsonOk({ member });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonErr("conflict", "That change collided with another update. Try again.", 409);
    }
    return handleApiError(err);
  }
}
