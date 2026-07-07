import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

/** Reset links are short-lived: one hour from request (roadmap contract). */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export type ResolvedPasswordReset = {
  status: "valid" | "used" | "expired";
  userName: string;
};

/** Shared by POST /api/auth/password-reset/confirm and the /reset-password/[token] page. */
export async function getPasswordResetByToken(token: string): Promise<ResolvedPasswordReset | null> {
  const reset = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!reset) return null;

  // Expiry is computed at read time (same pattern as invites) — no cron
  // needed to flip stale rows.
  const status =
    reset.usedAt !== null ? "used" : reset.expiresAt.getTime() < Date.now() ? "expired" : "valid";

  return { status, userName: reset.user.name };
}

export async function createPasswordReset(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await prisma.passwordResetToken.create({ data: { userId, token, expiresAt } });
  return { token, expiresAt };
}
