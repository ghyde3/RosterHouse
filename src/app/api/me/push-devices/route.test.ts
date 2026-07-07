import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createTestEmployee,
  createTestOrg,
  deleteTestOrg,
  type TestOrg,
} from "@/lib/test/factories";
import { DELETE, POST } from "./route";

const authMock = auth as unknown as Mock;

function post(body: unknown) {
  return POST(
    new Request("http://test.local/api/me/push-devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function del(body: unknown) {
  return DELETE(
    new Request("http://test.local/api/me/push-devices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("/api/me/push-devices", () => {
  let t: TestOrg;
  let emp: { userId: string; profileId: string };
  let otherEmp: { userId: string; profileId: string };
  const endpoint = "https://push.example.com/send/abc123";
  const subscription = {
    endpoint,
    keys: { p256dh: "p256dh-key", auth: "auth-key" },
  };

  beforeAll(async () => {
    t = await createTestOrg();
    emp = await createTestEmployee(t, "Devon Test");
    otherEmp = await createTestEmployee(t, "Sam Test");
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await post({ subscription });
    expect(res.status).toBe(401);
  });

  it("registers a device row with the exact token JSON", async () => {
    authMock.mockResolvedValue({ user: { id: emp.userId, role: "employee" } });
    const res = await post({ subscription: { ...subscription, expirationTime: null } });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: { registered: true } });

    const rows = await prisma.pushDevice.findMany({ where: { userId: emp.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].platform).toBe("web");
    expect(rows[0].token).toBe(
      JSON.stringify({ endpoint, keys: { p256dh: "p256dh-key", auth: "auth-key" } })
    );
  });

  it("moves the row when the same endpoint is registered under a different user", async () => {
    authMock.mockResolvedValue({ user: { id: otherEmp.userId, role: "employee" } });
    const res = await post({ subscription });
    expect(res.status).toBe(201);

    const oldRows = await prisma.pushDevice.findMany({ where: { userId: emp.userId } });
    expect(oldRows).toHaveLength(0);
    const newRows = await prisma.pushDevice.findMany({ where: { userId: otherEmp.userId } });
    expect(newRows).toHaveLength(1);
  });

  it("removes the device on DELETE", async () => {
    authMock.mockResolvedValue({ user: { id: otherEmp.userId, role: "employee" } });
    const res = await del({ endpoint });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: { removed: true } });

    const rows = await prisma.pushDevice.findMany({ where: { userId: otherEmp.userId } });
    expect(rows).toHaveLength(0);
  });

  it("rejects an invalid body", async () => {
    authMock.mockResolvedValue({ user: { id: emp.userId, role: "employee" } });
    const res = await post({ subscription: { endpoint: "not-a-url", keys: {} } });
    expect(res.status).toBe(400);
  });

  it("does not let a prefix endpoint sweep other users' devices (security regression)", async () => {
    const victimEndpoint = "https://fcm.googleapis.com/fcm/send/victim-device-abc123";
    const prefixEndpoint = "https://fcm.googleapis.com/fcm/send";

    // User A registers a real device endpoint on the shared FCM host.
    authMock.mockResolvedValue({ user: { id: emp.userId, role: "employee" } });
    const victimRes = await post({
      subscription: {
        endpoint: victimEndpoint,
        keys: { p256dh: "victim-p256dh", auth: "victim-auth" },
      },
    });
    expect(victimRes.status).toBe(201);

    // User B registers the bare host prefix — a substring of A's endpoint.
    authMock.mockResolvedValue({ user: { id: otherEmp.userId, role: "employee" } });
    const attackerRes = await post({
      subscription: {
        endpoint: prefixEndpoint,
        keys: { p256dh: "attacker-p256dh", auth: "attacker-auth" },
      },
    });
    expect(attackerRes.status).toBe(201);

    // B got a row for the prefix endpoint…
    const attackerRows = await prisma.pushDevice.findMany({
      where: { userId: otherEmp.userId },
    });
    expect(attackerRows).toHaveLength(1);
    expect(attackerRows[0].token).toBe(
      JSON.stringify({
        endpoint: prefixEndpoint,
        keys: { p256dh: "attacker-p256dh", auth: "attacker-auth" },
      })
    );

    // …and A's device was NOT swept by the prefix.
    const victimRows = await prisma.pushDevice.findMany({
      where: { userId: emp.userId, token: { contains: `"endpoint":"${victimEndpoint}"` } },
    });
    expect(victimRows).toHaveLength(1);
  });

  it("keeps exactly one row with the new keys when the same endpoint re-registers (key rotation)", async () => {
    const rotatedEndpoint = "https://push.example.com/send/rotation-xyz789";
    authMock.mockResolvedValue({ user: { id: emp.userId, role: "employee" } });

    const first = await post({
      subscription: { endpoint: rotatedEndpoint, keys: { p256dh: "old-p256dh", auth: "old-auth" } },
    });
    expect(first.status).toBe(201);

    const second = await post({
      subscription: { endpoint: rotatedEndpoint, keys: { p256dh: "new-p256dh", auth: "new-auth" } },
    });
    expect(second.status).toBe(201);

    const rows = await prisma.pushDevice.findMany({
      where: { token: { contains: `"endpoint":"${rotatedEndpoint}"` } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(emp.userId);
    expect(rows[0].token).toBe(
      JSON.stringify({
        endpoint: rotatedEndpoint,
        keys: { p256dh: "new-p256dh", auth: "new-auth" },
      })
    );
  });
});
