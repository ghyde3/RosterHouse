import type { ChannelDriver } from "./index";

/** v1 driver: logs delivery intents. Twilio/web-push replace this later. */
export const consoleDriver: ChannelDriver = {
  async sendSms(phone, body) {
    console.log(`[notify] sms → ${phone}: ${body}`);
  },
  async sendPush(deviceToken, payload) {
    console.log(`[notify] push → ${deviceToken}: ${payload.title} — ${payload.body}`);
  },
};
