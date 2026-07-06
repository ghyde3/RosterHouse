import type { NotificationType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { consoleDriver } from "./console-driver";

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
  driver: ChannelDriver = consoleDriver,
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

    if (prefs?.notifySms && user.phone) {
      await driver.sendSms(user.phone, `${input.title} — ${input.body}`);
      channels.push("sms");
    }
    if (prefs?.notifyPush && user.pushDevices.length > 0) {
      for (const device of user.pushDevices) {
        await driver.sendPush(device.token, { title: input.title, body: input.body });
      }
      channels.push("push");
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
