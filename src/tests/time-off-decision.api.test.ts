// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  requireUser: vi.fn(),
  requireManager: vi.fn(),
  apiUser: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

import { prisma } from "@/lib/db";
import { PATCH } from "@/app/api/time-off/[requestId]/route";
import { createFixture, destroyFixture, isoDateFromNow, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function patchReq(body: unknown): Request {
  return new Request("http://test/api/time-off/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function makeRequest(f: Fixture, profileId: string) {
  return prisma.timeOffRequest.create({
    data: {
      employeeProfileId: profileId,
      startDate: new Date(isoDateFromNow(14, f.timezone)),
      endDate: new Date(isoDateFromNow(16, f.timezone)),
      reason: "vacation",
    },
  });
}

describe("PATCH /api/time-off/[requestId]", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("approves in a transaction and notifies the employee", async () => {
    const request = await makeRequest(f, f.ana.profileId);
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(patchReq({ decision: "approve" }), { params: Promise.resolve({ requestId: request.id }) });
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("approved");

    const row = await prisma.timeOffRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(row.status).toBe("approved");
    expect(row.decidedByUserId).toBe(f.managerUserId);
    expect(row.decidedAt).not.toBeNull();

    const note = await prisma.notification.findFirst({
      where: { userId: f.ana.userId, type: "timeoff_approved" },
      orderBy: { createdAt: "desc" },
    });
    expect(note?.title).toBe("Time off approved");
    expect(note?.body).toContain("–"); // contains the date range
  });

  it("denies with an optional note appended to the notification body", async () => {
    const request = await makeRequest(f, f.ben.profileId);
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(patchReq({ decision: "deny", note: "That week is fully booked already." }), {
      params: Promise.resolve({ requestId: request.id }),
    });
    expect((await res.json()).data.status).toBe("denied");

    const note = await prisma.notification.findFirst({
      where: { userId: f.ben.userId, type: "timeoff_denied" },
      orderBy: { createdAt: "desc" },
    });
    expect(note?.body).toContain("Note from your manager: That week is fully booked already.");
  });

  it("returns 409 when the request was already decided", async () => {
    const request = await makeRequest(f, f.cal.profileId);
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    await PATCH(patchReq({ decision: "approve" }), { params: Promise.resolve({ requestId: request.id }) });
    const res = await PATCH(patchReq({ decision: "deny" }), { params: Promise.resolve({ requestId: request.id }) });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("already_decided");
  });

  it("rejects employees", async () => {
    const request = await makeRequest(f, f.ana.profileId);
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await PATCH(patchReq({ decision: "approve" }), { params: Promise.resolve({ requestId: request.id }) });
    expect(res.status).toBe(403);
  });
});
