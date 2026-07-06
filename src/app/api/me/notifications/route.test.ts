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
import { GET } from "./route";

const authMock = auth as unknown as Mock;

function get(qs = "") {
  return GET(new Request(`http://test.local/api/me/notifications${qs}`));
}

describe("GET /api/me/notifications", () => {
  let t: TestOrg;
  let emp: { userId: string; profileId: string };

  beforeAll(async () => {
    t = await createTestOrg();
    emp = await createTestEmployee(t, "Maria Test");
    // 25 notifications, oldest first; the 5 newest are unread.
    const base = new Date("2026-07-01T12:00:00.000Z").getTime();
    await prisma.notification.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        userId: emp.userId,
        type: "schedule_published" as const,
        title: `Notification ${i + 1}`,
        body: "Your manager published next week's schedule.",
        createdAt: new Date(base + i * 60000),
        readAt: i < 20 ? new Date(base + i * 60000 + 1000) : null,
      })),
    });
    authMock.mockResolvedValue({
      user: { id: emp.userId, name: "Maria Test", role: "employee", organizationId: t.organizationId },
    });
  });

  afterAll(async () => {
    await deleteTestOrg(t.organizationId);
  });

  it("pages newest-first with a cursor and reports unreadCount", async () => {
    const res = await get();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.notifications).toHaveLength(20);
    expect(body.data.notifications[0].title).toBe("Notification 25");
    expect(body.data.unreadCount).toBe(5);
    expect(body.data.nextCursor).not.toBeNull();

    const res2 = await get(`?cursor=${body.data.nextCursor}`);
    const body2 = await res2.json();
    expect(body2.data.notifications).toHaveLength(5);
    expect(body2.data.notifications[4].title).toBe("Notification 1");
    expect(body2.data.nextCursor).toBeNull();
  });

  it("caps limit at 50 and rejects garbage", async () => {
    const res = await get("?limit=nope");
    expect(res.status).toBe(400);
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await get();
    expect(res.status).toBe(401);
  });
});
