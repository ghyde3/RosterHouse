import { z } from "zod";
import { handleApiError, jsonErr, jsonOk, parseJson } from "@/lib/api";
import { hashPassword } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { Prisma } from "@/generated/prisma/client";

const acceptSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  phone: z.string().trim().min(1, "Enter your phone number."),
  password: z.string().min(8, "Password needs at least 8 characters."),
});

const PHONE_TAKEN_MESSAGE = "That phone number is already on an account. Try logging in instead.";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const parsed = await parseJson(req, acceptSchema);
    if (parsed.error) return parsed.error;
    const { name, password } = parsed.data;

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) {
      return jsonErr("invalid_phone", "That phone number doesn't look right. Use 10 digits, like (555) 123-4567.", 400);
    }

    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite) return jsonErr("invite_not_found", "That invite link isn't valid.", 404);
    if (invite.status === "accepted") {
      return jsonErr("invite_used", "That invite has already been used. Try logging in instead.", 410);
    }
    if (invite.status === "expired" || (invite.expiresAt !== null && invite.expiresAt.getTime() < Date.now())) {
      return jsonErr("invite_expired", "That invite has expired. Ask your manager to send a new one.", 410);
    }

    const phoneTaken = await prisma.user.findFirst({ where: { phone } });
    if (phoneTaken) {
      return jsonErr("phone_taken", PHONE_TAKEN_MESSAGE, 409);
    }

    const passwordHash = await hashPassword(password); // slow — outside the transaction

    await prisma.$transaction(async (tx) => {
      // The invitee didn't choose the invite's email; if it's taken, drop it
      // rather than block them — they log in by phone.
      let email = invite.email?.toLowerCase() ?? null;
      if (email) {
        const emailTaken = await tx.user.findFirst({ where: { email } });
        if (emailTaken) email = null;
      }

      const user = await tx.user.create({
        data: {
          organizationId: invite.organizationId,
          name,
          email,
          phone,
          passwordHash,
          role: "employee",
        },
      });
      const profile = await tx.employeeProfile.create({
        data: {
          userId: user.id,
          locationId: invite.locationId,
          primaryPositionId: invite.positionId,
          status: "active",
        },
      });
      if (invite.positionId) {
        await tx.employeePosition.create({
          data: { employeeProfileId: profile.id, positionId: invite.positionId },
        });
      }
      await tx.invite.update({ where: { id: invite.id }, data: { status: "accepted" } });
    });

    return jsonOk({ signedUp: true }, 201);
  } catch (err) {
    // Defense-in-depth: the pre-check above closes the common case, but a
    // concurrent acceptance with the same phone can still race past it and
    // hit the unique constraint inside the transaction. Map that to the same
    // calm 409 instead of leaking a raw Prisma error.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = err.meta?.target as string[] | undefined;
      if (target && (target.includes("phone") || target.includes("email"))) {
        return jsonErr("phone_taken", PHONE_TAKEN_MESSAGE, 409);
      }
    }
    return handleApiError(err);
  }
}
