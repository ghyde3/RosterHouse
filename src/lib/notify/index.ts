import type { NotificationType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { defaultDriver } from "./driver";
import { PushSubscriptionGoneError } from "./errors";
import { smsBodyFor } from "./templates";

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
};

export interface ChannelDriver {
  sendSms(phone: string, body: string): Promise<void>;
  sendPush(deviceToken: string, payload: { title: string; body: string }): Promise<void>;
}

/**
 * Write Notification rows (the in-app feed), then fan out through the
 * user's channel prefs via the driver. Returns how many users got a row —
 * this is the number surfaced in publish confirmations, so it must be real.
 */
export async function notifyUsers(
  inputs: NotifyInput[],
  driver: ChannelDriver = defaultDriver(),
): Promise<{ count: number }> {
  let count = 0;
  for (const input of inputs) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      include: { profiles: true, pushDevices: true },
    });
    if (!user) continue;

    // v1: one location per user, so one profile carries the prefs.
    const prefs = user.profiles[0] ?? null;
    const channels: string[] = [];

    // A failing channel must not abort the fan-out or skip the in-app row —
    // channelsSent records only what was actually handed to the provider.
    if (prefs?.notifySms && user.phone) {
      try {
        await driver.sendSms(user.phone, smsBodyFor(input));
        channels.push("sms");
      } catch (err) {
        console.error(`[notify] sms delivery failed for user ${user.id}`, err);
      }
    }
    if (prefs?.notifyPush && user.pushDevices.length > 0) {
      let delivered = false;
      for (const device of user.pushDevices) {
        try {
          await driver.sendPush(device.token, { title: input.title, body: input.body });
          delivered = true;
        } catch (err) {
          if (err instanceof PushSubscriptionGoneError) {
            // The push service says this subscription is dead — drop it.
            await prisma.pushDevice.delete({ where: { id: device.id } }).catch(() => {});
          } else {
            console.error(`[notify] push delivery failed for user ${user.id}`, err);
          }
        }
      }
      if (delivered) channels.push("push");
    }

    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        channelsSent: channels,
      },
    });
    count += 1;
  }
  return { count };
}
