/**
 * Twilio SMS driver. Used by defaultDriver() when the three TWILIO_* env
 * vars are set; otherwise the console driver logs the intent instead.
 */
export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

/** Send one SMS via Twilio's REST API. `phone` is already E.164. */
export async function sendTwilioSms(phone: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !fromNumber) {
    throw new Error("Twilio is not configured.");
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, From: fromNumber, Body: body }),
    },
  );

  if (!res.ok) {
    let detail = "";
    try {
      const parsed = (await res.json()) as { message?: unknown };
      if (typeof parsed.message === "string") {
        detail = parsed.message.slice(0, 200);
      }
    } catch {
      // Body wasn't JSON — the status alone will have to do.
    }
    throw new Error(
      `Twilio SMS send failed (${res.status})${detail ? `: ${detail}` : "."}`,
    );
  }
}
