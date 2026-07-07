import { z } from "zod";
import { ApiError, handleApiError, jsonErr, jsonOk, parseJson } from "@/lib/api";
import { hashPassword } from "@/lib/authz";
import { prisma } from "@/lib/db";

const confirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password needs at least 8 characters."),
});

const RESET_USED_MESSAGE = "That reset link was already used. Request a new one.";

export async function POST(req: Request) {
  try {
    const parsed = await parseJson(req, confirmSchema);
    if (parsed.error) return parsed.error;
    const { token, password } = parsed.data;

    const reset = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!reset) {
      return jsonErr("reset_not_found", "That reset link isn't valid. Request a new one.", 404);
    }
    if (reset.usedAt !== null) {
      return jsonErr("reset_used", RESET_USED_MESSAGE, 410);
    }
    if (reset.expiresAt.getTime() < Date.now()) {
      return jsonErr("reset_expired", "That reset link has expired. Request a new one.", 410);
    }

    const passwordHash = await hashPassword(password); // slow — outside the transaction

    await prisma.$transaction(async (tx) => {
      // Atomically claim the token as the FIRST write in the transaction —
      // the pre-checks above read outside it, so two concurrent confirms can
      // both pass them. Only one caller's WHERE (id, usedAt: null) can match.
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: reset.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new ApiError(410, "reset_used", RESET_USED_MESSAGE);
      }

      await tx.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      });

      // The password just changed, so any other outstanding links for this
      // user are stale — retire them.
      await tx.passwordResetToken.updateMany({
        where: { userId: reset.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
    });

    return jsonOk({ reset: true });
  } catch (err) {
    return handleApiError(err);
  }
}
