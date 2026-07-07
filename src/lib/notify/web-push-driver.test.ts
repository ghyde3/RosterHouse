import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import webpush from "web-push";
import { PushSubscriptionGoneError } from "@/lib/notify/errors";
import { isWebPushConfigured, sendWebPush } from "@/lib/notify/web-push-driver";

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

const PUBLIC_KEY = "test-vapid-public-key";
const PRIVATE_KEY = "test-vapid-private-key";

const subscription = {
  endpoint: "https://push.example.com/send/abc123",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
};
const deviceToken = JSON.stringify(subscription);
const payload = { title: "New schedule published", body: "Your schedule is ready." };

beforeEach(() => {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = PUBLIC_KEY;
  process.env.VAPID_PRIVATE_KEY = PRIVATE_KEY;
  vi.mocked(webpush.setVapidDetails).mockClear();
  vi.mocked(webpush.sendNotification).mockClear();
  vi.mocked(webpush.sendNotification).mockResolvedValue(undefined as never);
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
});

describe("isWebPushConfigured", () => {
  it("is true when both VAPID keys are set", () => {
    expect(isWebPushConfigured()).toBe(true);
  });

  it("is false when either key is unset", () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    expect(isWebPushConfigured()).toBe(false);

    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    expect(isWebPushConfigured()).toBe(false);
  });
});

describe("sendWebPush", () => {
  it("sets VAPID details from env and sends the JSON payload to the parsed subscription", async () => {
    await sendWebPush(deviceToken, payload);

    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      "mailto:ops@rosterhouse.app",
      PUBLIC_KEY,
      PRIVATE_KEY,
    );
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      subscription,
      JSON.stringify(payload),
    );
  });

  it("uses VAPID_SUBJECT when set", async () => {
    process.env.VAPID_SUBJECT = "mailto:custom@rosterhouse.app";
    await sendWebPush(deviceToken, payload);

    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      "mailto:custom@rosterhouse.app",
      PUBLIC_KEY,
      PRIVATE_KEY,
    );
  });

  it("maps a 410 from the push service to PushSubscriptionGoneError", async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce(
      Object.assign(new Error("Received unexpected response code"), { statusCode: 410 }),
    );
    await expect(sendWebPush(deviceToken, payload)).rejects.toBeInstanceOf(
      PushSubscriptionGoneError,
    );
  });

  it("maps a 404 from the push service to PushSubscriptionGoneError", async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce(
      Object.assign(new Error("Received unexpected response code"), { statusCode: 404 }),
    );
    await expect(sendWebPush(deviceToken, payload)).rejects.toBeInstanceOf(
      PushSubscriptionGoneError,
    );
  });

  it("treats an unparseable device token as a gone subscription without calling web-push", async () => {
    await expect(sendWebPush("not-json", payload)).rejects.toBeInstanceOf(
      PushSubscriptionGoneError,
    );
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("treats a token with no endpoint as a gone subscription without calling web-push", async () => {
    await expect(
      sendWebPush(JSON.stringify({ keys: subscription.keys }), payload),
    ).rejects.toBeInstanceOf(PushSubscriptionGoneError);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("rethrows other push service errors unchanged", async () => {
    const original = Object.assign(new Error("Internal server error"), { statusCode: 500 });
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce(original);
    await expect(sendWebPush(deviceToken, payload)).rejects.toBe(original);
  });
});
