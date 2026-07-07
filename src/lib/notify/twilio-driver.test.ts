import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTwilioConfigured, sendTwilioSms } from "@/lib/notify/twilio-driver";

const SID = "ACtest0000000000000000000000000000";
const TOKEN = "auth-token-secret";
const FROM = "+15550000000";

beforeEach(() => {
  process.env.TWILIO_ACCOUNT_SID = SID;
  process.env.TWILIO_AUTH_TOKEN = TOKEN;
  process.env.TWILIO_FROM_NUMBER = FROM;
});

afterEach(() => {
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_FROM_NUMBER;
  vi.unstubAllGlobals();
});

describe("isTwilioConfigured", () => {
  it("is true when all three env vars are set", () => {
    expect(isTwilioConfigured()).toBe(true);
  });

  it("is false when any env var is unset", () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    expect(isTwilioConfigured()).toBe(false);

    process.env.TWILIO_ACCOUNT_SID = SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    expect(isTwilioConfigured()).toBe(false);

    process.env.TWILIO_AUTH_TOKEN = TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    expect(isTwilioConfigured()).toBe(false);
  });
});

describe("sendTwilioSms", () => {
  it("POSTs the message to the account's Messages endpoint with Basic auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);

    await sendTwilioSms("+15551234567", "RosterHouse: Shift soon. Starts at 3:00 PM.");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(SID);
    expect(url).toBe(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`);
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe(
      "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
    );
    expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");

    const params = init.body as URLSearchParams;
    expect(params.get("To")).toBe("+15551234567");
    expect(params.get("From")).toBe(FROM);
    expect(params.get("Body")).toBe("RosterHouse: Shift soon. Starts at 3:00 PM.");
  });

  it("rejects with Twilio's message on a non-2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: 21211, message: "The 'To' number is not a valid phone number." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendTwilioSms("+15551234567", "hello")).rejects.toThrow(
      /400.*The 'To' number is not a valid phone number\./,
    );
  });

  it("rejects with the status alone when the error body is not JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error("not json");
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendTwilioSms("+15551234567", "hello")).rejects.toThrow(/503/);
  });
});
