import { z } from "zod";
import { handleApiError, jsonOk, parseJson } from "@/lib/api";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { sendEmail } from "@/lib/email";
import { defaultDriver } from "@/lib/notify/driver";
import { createPasswordReset } from "@/lib/password-reset";

const requestSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your phone or email."),
});

export async function POST(req: Request) {
  try {
    const parsed = await parseJson(req, requestSchema);
    if (parsed.error) return parsed.error;
    const { identifier } = parsed.data;

    // Resolve the identifier to a user, remembering which channel matched so
    // delivery goes back the same way the person reached us.
    let matched: { userId: string; via: "email"; to: string } | { userId: string; via: "phone"; to: string } | null =
      null;
    if (identifier.includes("@")) {
      const email = identifier.toLowerCase();
      const user = await prisma.user.findFirst({ where: { email } });
      if (user?.email) matched = { userId: user.id, via: "email", to: user.email };
    } else {
      const phone = normalizePhone(identifier);
      if (phone) {
        const user = await prisma.user.findFirst({ where: { phone } });
        if (user?.phone) matched = { userId: user.id, via: "phone", to: user.phone };
      }
    }

    if (matched) {
      const { token } = await createPasswordReset(matched.userId);
      const link = `${process.env.APP_URL ?? new URL(req.url).origin}/reset-password/${token}`;
      // Delivery failure must not change the response — a distinguishable
      // error here would leak which identifiers have accounts.
      try {
        if (matched.via === "email") {
          await sendEmail({
            to: matched.to,
            subject: "Reset your RosterHouse password",
            text: [
              "Someone asked to reset the password for your RosterHouse account.",
              "",
              `Reset it here: ${link}`,
              "",
              "It expires in 1 hour.",
              "",
              "If you didn't ask for this, you can ignore this email.",
            ].join("\n"),
          });
        } else {
          await defaultDriver().sendSms(
            matched.to,
            `RosterHouse: reset your password: ${link} — this link expires in 1 hour.`,
          );
        }
      } catch (err) {
        console.error("password reset delivery failed", err);
      }
    }

    // Always the same answer, matched or not — no account enumeration.
    return jsonOk({ requested: true });
  } catch (err) {
    return handleApiError(err);
  }
}
