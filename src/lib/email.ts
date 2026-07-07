/**
 * Transactional email (password reset links). Resend when RESEND_API_KEY is
 * set, console logging otherwise — same graceful-absence pattern as the
 * notify channel drivers.
 */
export type EmailInput = {
  to: string;
  subject: string;
  text: string;
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(input: EmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email] → ${input.to}: ${input.subject}\n${input.text}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "RosterHouse <noreply@rosterhouse.app>",
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend responded ${res.status}: ${detail.slice(0, 200)}`);
  }
}
