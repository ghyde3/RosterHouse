import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isEmailConfigured, sendEmail } from "@/lib/email";

const savedEnv: Record<string, string | undefined> = {};
let fetchMock: ReturnType<typeof vi.fn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  savedEnv.RESEND_API_KEY = process.env.RESEND_API_KEY;
  savedEnv.EMAIL_FROM = process.env.EMAIL_FROM;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;

  fetchMock = vi.fn(async () => ({ ok: true }) as Response);
  vi.stubGlobal("fetch", fetchMock);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  for (const key of ["RESEND_API_KEY", "EMAIL_FROM"] as const) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
  logSpy.mockRestore();
});

describe("isEmailConfigured", () => {
  it("reflects the presence of RESEND_API_KEY", () => {
    expect(isEmailConfigured()).toBe(false);
    process.env.RESEND_API_KEY = "re_test_key";
    expect(isEmailConfigured()).toBe(true);
  });
});

describe("sendEmail", () => {
  const input = {
    to: "pat@example.com",
    subject: "Reset your password",
    text: "Here is your link.",
  };

  it("logs to the console and skips the network when no API key is set", async () => {
    await expect(sendEmail(input)).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = logSpy.mock.calls[0][0] as string;
    expect(logged).toContain("pat@example.com");
    expect(logged).toContain("Reset your password");
    expect(logged).toContain("Here is your link.");
  });

  it("posts to Resend with the API key and EMAIL_FROM when configured", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "Ops <ops@example.com>";

    await sendEmail(input);

    expect(logSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer re_test_key",
    );
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.from).toBe("Ops <ops@example.com>");
    expect(body.to).toEqual(["pat@example.com"]);
    expect(body.subject).toBe("Reset your password");
    expect(body.text).toBe("Here is your link.");
  });

  it("rejects with the status when Resend responds non-ok", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => "missing required field",
    } as Response);

    await expect(sendEmail(input)).rejects.toThrow(/422.*missing required field/);
  });
});
