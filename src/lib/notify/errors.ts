/**
 * Thrown by push drivers when the push service says the subscription no
 * longer exists (HTTP 404/410) or the stored token can't be parsed into a
 * subscription. notifyUsers reacts by deleting the dead PushDevice row.
 */
export class PushSubscriptionGoneError extends Error {
  constructor(message = "Push subscription is gone.") {
    super(message);
    this.name = "PushSubscriptionGoneError";
  }
}
