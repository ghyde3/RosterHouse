import "dotenv/config"; // defensive: @/lib/db builds the Prisma client from DATABASE_URL at import time
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { notifyUsers, type ChannelDriver } from "@/lib/notify";
import { PushSubscriptionGoneError } from "@/lib/notify/errors";

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
      {
        phone: "+15550001111",
        body: "RosterHouse: New schedule published. Your schedule for the week of Jul 6 is ready. http://localhost:3000/shifts",
      },
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

describe("notifyUsers delivery failures", () => {
  // Dedicated users so channel-failure tests can't disturb the fixtures above.
  let failSmsUserId: string;
  let goneDeviceUserId: string;
  let genericFailUserId: string;
  let twoDeviceUserId: string;

  beforeAll(async () => {
    const location = await prisma.location.findFirstOrThrow({
      where: { organizationId: orgId },
    });
    const base = {
      organizationId: orgId,
      passwordHash: "irrelevant",
      role: "employee" as const,
    };

    const failSmsUser = await prisma.user.create({
      data: {
        ...base,
        name: "Fail Fiona",
        email: "fiona@notify.test",
        phone: "+15550002222",
        profiles: {
          create: { locationId: location.id, status: "active", notifySms: true, notifyPush: false },
        },
      },
    });
    failSmsUserId = failSmsUser.id;

    const goneDeviceUser = await prisma.user.create({
      data: {
        ...base,
        name: "Gone Gary",
        email: "gary@notify.test",
        pushDevices: { create: { token: "gone-device", platform: "web" } },
        profiles: {
          create: { locationId: location.id, status: "active", notifySms: false, notifyPush: true },
        },
      },
    });
    goneDeviceUserId = goneDeviceUser.id;

    const genericFailUser = await prisma.user.create({
      data: {
        ...base,
        name: "Generic Greta",
        email: "greta@notify.test",
        pushDevices: { create: { token: "generic-device", platform: "web" } },
        profiles: {
          create: { locationId: location.id, status: "active", notifySms: false, notifyPush: true },
        },
      },
    });
    genericFailUserId = genericFailUser.id;

    const twoDeviceUser = await prisma.user.create({
      data: {
        ...base,
        name: "Two-device Tara",
        email: "tara@notify.test",
        pushDevices: {
          create: [
            { token: "flaky-device", platform: "web" },
            { token: "healthy-device", platform: "web" },
          ],
        },
        profiles: {
          create: { locationId: location.id, status: "active", notifySms: false, notifyPush: true },
        },
      },
    });
    twoDeviceUserId = twoDeviceUser.id;
  });

  it("still writes the row and processes the rest of the batch when sendSms throws", async () => {
    const driver: ChannelDriver = {
      async sendSms() {
        throw new Error("Twilio SMS send failed (500).");
      },
      async sendPush() {},
    };
    const result = await notifyUsers(
      [
        { userId: failSmsUserId, type: "shift_reminder", title: "Sms fails", body: "Starts at 3:00 PM." },
        { userId: quietUserId, type: "shift_reminder", title: "Sms fails", body: "Starts at 3:00 PM." },
      ],
      driver,
    );
    expect(result).toEqual({ count: 2 });

    const failRow = await prisma.notification.findFirstOrThrow({
      where: { userId: failSmsUserId, title: "Sms fails" },
    });
    expect(failRow.channelsSent).not.toContain("sms");

    const nextRow = await prisma.notification.findFirst({
      where: { userId: quietUserId, title: "Sms fails" },
    });
    expect(nextRow).not.toBeNull();
  });

  it("deletes the device row when sendPush throws PushSubscriptionGoneError", async () => {
    const driver: ChannelDriver = {
      async sendSms() {},
      async sendPush() {
        throw new PushSubscriptionGoneError();
      },
    };
    const result = await notifyUsers(
      [{ userId: goneDeviceUserId, type: "swap_approved", title: "Gone device", body: "Covered." }],
      driver,
    );
    expect(result).toEqual({ count: 1 });

    const devices = await prisma.pushDevice.findMany({ where: { userId: goneDeviceUserId } });
    expect(devices).toHaveLength(0);

    const row = await prisma.notification.findFirstOrThrow({
      where: { userId: goneDeviceUserId, title: "Gone device" },
    });
    expect(row.channelsSent).not.toContain("push");
  });

  it("keeps the device row and skips the channel when sendPush throws a generic error", async () => {
    const driver: ChannelDriver = {
      async sendSms() {},
      async sendPush() {
        throw new Error("push service hiccup");
      },
    };
    const result = await notifyUsers(
      [{ userId: genericFailUserId, type: "swap_denied", title: "Push hiccup", body: "Denied." }],
      driver,
    );
    expect(result).toEqual({ count: 1 });

    const devices = await prisma.pushDevice.findMany({ where: { userId: genericFailUserId } });
    expect(devices).toHaveLength(1);

    const row = await prisma.notification.findFirstOrThrow({
      where: { userId: genericFailUserId, title: "Push hiccup" },
    });
    expect(row.channelsSent).not.toContain("push");
  });

  it("records push when one device fails generically but another succeeds", async () => {
    const driver: ChannelDriver = {
      async sendSms() {},
      async sendPush(token) {
        if (token === "flaky-device") throw new Error("push service hiccup");
      },
    };
    const result = await notifyUsers(
      [{ userId: twoDeviceUserId, type: "open_shift_posted", title: "Two devices", body: "Open shift." }],
      driver,
    );
    expect(result).toEqual({ count: 1 });

    const devices = await prisma.pushDevice.findMany({ where: { userId: twoDeviceUserId } });
    expect(devices).toHaveLength(2);

    const row = await prisma.notification.findFirstOrThrow({
      where: { userId: twoDeviceUserId, title: "Two devices" },
    });
    expect(row.channelsSent).toContain("push");
  });
});
