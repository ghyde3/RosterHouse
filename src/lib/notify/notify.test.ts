import "dotenv/config"; // defensive: @/lib/db builds the Prisma client from DATABASE_URL at import time
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { notifyUsers, type ChannelDriver } from "@/lib/notify";

// The test owns its fixtures — a throwaway org so seed data stays untouched.
let orgId: string;
let smsUserId: string;   // sms + push on, phone + device present
let quietUserId: string; // all channels off

function fakeDriver() {
  const sms: { phone: string; body: string }[] = [];
  const push: { token: string; title: string }[] = [];
  const driver: ChannelDriver = {
    async sendSms(phone, body) {
      sms.push({ phone, body });
    },
    async sendPush(token, payload) {
      push.push({ token, title: payload.title });
    },
  };
  return { driver, sms, push };
}

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: {
      name: "Notify test org",
      locations: { create: { name: "Test location", timezone: "America/New_York" } },
    },
    include: { locations: true },
  });
  orgId = org.id;
  const locationId = org.locations[0].id;

  const smsUser = await prisma.user.create({
    data: {
      organizationId: orgId,
      name: "Notified Nancy",
      email: "nancy@notify.test",
      phone: "+15550001111",
      passwordHash: "irrelevant",
      role: "employee",
      pushDevices: { create: { token: "device-token-1", platform: "web" } },
      profiles: {
        create: { locationId, status: "active", notifySms: true, notifyPush: true },
      },
    },
  });
  smsUserId = smsUser.id;

  const quietUser = await prisma.user.create({
    data: {
      organizationId: orgId,
      name: "Quiet Quentin",
      email: "quentin@notify.test",
      passwordHash: "irrelevant",
      role: "employee",
      profiles: {
        create: { locationId, status: "active", notifySms: false, notifyPush: false },
      },
    },
  });
  quietUserId = quietUser.id;
});

afterAll(async () => {
  // Cascades: users → profiles/devices/notifications.
  await prisma.organization.delete({ where: { id: orgId } });
});

describe("notifyUsers", () => {
  it("writes rows, respects channel prefs, and returns the real count", async () => {
    const { driver, sms, push } = fakeDriver();
    const result = await notifyUsers(
      [
        {
          userId: smsUserId,
          type: "schedule_published",
          title: "New schedule published",
          body: "Your schedule for the week of Jul 6 is ready.",
        },
        {
          userId: quietUserId,
          type: "schedule_published",
          title: "New schedule published",
          body: "Your schedule for the week of Jul 6 is ready.",
        },
      ],
      driver,
    );
    expect(result).toEqual({ count: 2 });

    const rows = await prisma.notification.findMany({
      where: { userId: { in: [smsUserId, quietUserId] } },
    });
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.userId === smsUserId)?.channelsSent.sort()).toEqual(["push", "sms"]);
    expect(rows.find((r) => r.userId === quietUserId)?.channelsSent).toEqual([]);

    expect(sms).toEqual([
      { phone: "+15550001111", body: "New schedule published — Your schedule for the week of Jul 6 is ready." },
    ]);
    expect(push).toEqual([{ token: "device-token-1", title: "New schedule published" }]);
  });

  it("skips unknown users and still counts the rest", async () => {
    const { driver } = fakeDriver();
    const result = await notifyUsers(
      [
        { userId: "no-such-user", type: "shift_reminder", title: "Shift soon", body: "Starts at 3:00 PM." },
        { userId: smsUserId, type: "shift_reminder", title: "Shift soon", body: "Starts at 3:00 PM." },
      ],
      driver,
    );
    expect(result).toEqual({ count: 1 });
  });
});
