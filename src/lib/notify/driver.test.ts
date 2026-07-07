import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./twilio-driver", () => ({
  isTwilioConfigured: vi.fn(() => false),
  sendTwilioSms: vi.fn(async () => {}),
}));
vi.mock("./web-push-driver", () => ({
  isWebPushConfigured: vi.fn(() => false),
  sendWebPush: vi.fn(async () => {}),
}));

import { defaultDriver } from "./driver";
import { isTwilioConfigured, sendTwilioSms } from "./twilio-driver";
import { isWebPushConfigured, sendWebPush } from "./web-push-driver";

const mockedIsTwilioConfigured = vi.mocked(isTwilioConfigured);
const mockedSendTwilioSms = vi.mocked(sendTwilioSms);
const mockedIsWebPushConfigured = vi.mocked(isWebPushConfigured);
const mockedSendWebPush = vi.mocked(sendWebPush);

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedIsTwilioConfigured.mockReturnValue(false);
  mockedIsWebPushConfigured.mockReturnValue(false);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

describe("defaultDriver sms routing", () => {
  it("falls back to the console driver when Twilio is not configured", async () => {
    await defaultDriver().sendSms("+15550001111", "hello there");

    expect(mockedSendTwilioSms).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("[notify] sms → +15550001111: hello there");
  });

  it("sends through Twilio when configured, without touching the console", async () => {
    mockedIsTwilioConfigured.mockReturnValue(true);

    await defaultDriver().sendSms("+15550001111", "hello there");

    expect(mockedSendTwilioSms).toHaveBeenCalledTimes(1);
    expect(mockedSendTwilioSms).toHaveBeenCalledWith("+15550001111", "hello there");
    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe("defaultDriver push routing", () => {
  const payload = { title: "Shift reminder", body: "You work at 4 PM." };

  it("falls back to the console driver when web push is not configured", async () => {
    await defaultDriver().sendPush("device-token-1", payload);

    expect(mockedSendWebPush).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      "[notify] push → device-token-1: Shift reminder — You work at 4 PM.",
    );
  });

  it("sends through web push when configured, without touching the console", async () => {
    mockedIsWebPushConfigured.mockReturnValue(true);

    await defaultDriver().sendPush("device-token-1", payload);

    expect(mockedSendWebPush).toHaveBeenCalledTimes(1);
    expect(mockedSendWebPush).toHaveBeenCalledWith("device-token-1", payload);
    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe("defaultDriver call-time selection", () => {
  it("re-checks configuration on every send, not at driver construction", async () => {
    const driver = defaultDriver();

    mockedIsTwilioConfigured.mockReturnValue(false);
    await driver.sendSms("+15550001111", "first");
    expect(mockedSendTwilioSms).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("[notify] sms → +15550001111: first");

    mockedIsTwilioConfigured.mockReturnValue(true);
    await driver.sendSms("+15550001111", "second");
    expect(mockedSendTwilioSms).toHaveBeenCalledTimes(1);
    expect(mockedSendTwilioSms).toHaveBeenCalledWith("+15550001111", "second");
    expect(logSpy).toHaveBeenCalledTimes(1); // no new console log for the second send
  });
});
