import type { ChannelDriver } from "./index";
import { consoleDriver } from "./console-driver";
import { isTwilioConfigured, sendTwilioSms } from "./twilio-driver";
import { isWebPushConfigured, sendWebPush } from "./web-push-driver";

/**
 * Compose the production driver per channel: Twilio and web-push when their
 * env vars are set, the console driver otherwise. Read at call time (not
 * module load) so tests and deploys can toggle env without re-importing.
 */
export function defaultDriver(): ChannelDriver {
  return {
    async sendSms(phone, body) {
      if (isTwilioConfigured()) return sendTwilioSms(phone, body);
      return consoleDriver.sendSms(phone, body);
    },
    async sendPush(deviceToken, payload) {
      if (isWebPushConfigured()) return sendWebPush(deviceToken, payload);
      return consoleDriver.sendPush(deviceToken, payload);
    },
  };
}
