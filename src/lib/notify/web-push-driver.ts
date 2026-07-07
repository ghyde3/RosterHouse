import webpush from "web-push";
import { PushSubscriptionGoneError } from "./errors";

/**
 * Web-push driver. PushDevice.token stores JSON.stringify({ endpoint,
 * keys: { p256dh, auth } }) — the shared contract with the client.
 */
export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

type StoredSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function hasStatusCode(err: unknown): err is { statusCode: number } {
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { statusCode?: unknown }).statusCode === "number"
  );
}

export async function sendWebPush(
  deviceToken: string,
  payload: { title: string; body: string },
): Promise<void> {
  let subscription: StoredSubscription;
  try {
    subscription = JSON.parse(deviceToken) as StoredSubscription;
  } catch {
    // A token we can't parse can never be delivered to — treat as dead.
    throw new PushSubscriptionGoneError("Stored push subscription is unreadable.");
  }
  if (
    !subscription ||
    typeof subscription.endpoint !== "string" ||
    subscription.endpoint.length === 0
  ) {
    throw new PushSubscriptionGoneError("Stored push subscription has no endpoint.");
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("Web push is not configured.");
  }

  // Cheap; set per send so env changes don't require a re-import.
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:ops@rosterhouse.app",
    publicKey,
    privateKey,
  );

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (err) {
    if (hasStatusCode(err) && (err.statusCode === 404 || err.statusCode === 410)) {
      // The push service says this subscription no longer exists.
      throw new PushSubscriptionGoneError();
    }
    throw err;
  }
}
