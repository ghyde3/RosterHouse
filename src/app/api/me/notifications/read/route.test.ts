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
import { POST } from "./route";

const authMock = auth as unknown as Mock;

function post(body: unknown) {
  return POST(
    new Request("http://test.local/api/me/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/me/notifications/read", () => {
  let t: TestOrg;
  let emp: { userId: string; profileId: string };
  let other: { userId: string; profileId: string };
  let otherNotifId: string;

  beforeAll(async () => {
    t = await createTestOrg();
    emp = await createTestEmployee(t, "Maria Test");
    other = await createTestEmployee(t, "Sam Test");
    const mk = (userId: string, title: string) =>
      prisma.notification.create({
        data: {
          userId,
          type: "schedule_published",
          title,
          body: "Your manager published next week's schedule.",
        },
      });
    await mk(emp.userId, "A");
    await mk(emp.userId, "B");
    const theirs = await mk(other.userId, "Not yours");
    otherNotifId = theirs.id;
    authMock.mockResolvedValue({
      user: { id: emp.userId, name: "Maria Test", role: "employee", organizationId: t.organizationId },
    });
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("cannot mark another user's notification", async () => {
    const res = await post({ ids: [otherNotifId] });
    const body = await res.json();
    expect(body.data.updated).toBe(0);
    const theirs = await prisma.notification.findUniqueOrThrow({ where: { id: otherNotifId } });
    expect(theirs.readAt).toBeNull();
  });

  it("marks all my unread notifications when ids are omitted", async () => {
    const res = await post({});
    const body = await res.json();
    expect(body.data.updated).toBe(2);
    const unread = await prisma.notification.count({
      where: { userId: emp.userId, readAt: null },
    });
    expect(unread).toBe(0);
    // Idempotent: nothing left to mark.
    const again = await post({});
    expect((await again.json()).data.updated).toBe(0);
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await post({});
    expect(res.status).toBe(401);
  });
});
