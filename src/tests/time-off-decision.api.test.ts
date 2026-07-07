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

async function makeRequest(
  f: Fixture,
  profileId: string,
  opts?: { reason?: "vacation" | "sick" | "personal" | "other"; startOffset?: number; endOffset?: number },
) {
  return prisma.timeOffRequest.create({
    data: {
      employeeProfileId: profileId,
      startDate: new Date(isoDateFromNow(opts?.startOffset ?? 14, f.timezone)),
      endDate: new Date(isoDateFromNow(opts?.endOffset ?? 16, f.timezone)),
      reason: opts?.reason ?? "vacation",
    },
  });
}

async function setBalances(profileId: string, vacation: number | null, sick: number | null) {
  await prisma.employeeProfile.update({
    where: { id: profileId },
    data: { vacationBalanceHours: vacation, sickBalanceHours: sick },
  });
}

async function balancesOf(profileId: string): Promise<{ vacation: number | null; sick: number | null }> {
  const p = await prisma.employeeProfile.findUniqueOrThrow({ where: { id: profileId } });
  return {
    vacation: p.vacationBalanceHours === null ? null : Number(p.vacationBalanceHours),
    sick: p.sickBalanceHours === null ? null : Number(p.sickBalanceHours),
  };
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

  it("approving vacation deducts 8h per inclusive day and may go negative", async () => {
    await setBalances(f.ana.profileId, 20, 10);
    // 14..16 = 3 inclusive days = 24h → 20 - 24 = -4.
    const request = await makeRequest(f, f.ana.profileId, { reason: "vacation" });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(patchReq({ decision: "approve" }), { params: Promise.resolve({ requestId: request.id }) });
    expect(res.status).toBe(200);
    expect(await balancesOf(f.ana.profileId)).toEqual({ vacation: -4, sick: 10 });
  });

  it("approving sick deducts from the sick bucket only", async () => {
    await setBalances(f.ben.profileId, 40, 24);
    // Single-day request = 8h.
    const request = await makeRequest(f, f.ben.profileId, { reason: "sick", startOffset: 20, endOffset: 20 });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    await PATCH(patchReq({ decision: "approve" }), { params: Promise.resolve({ requestId: request.id }) });
    expect(await balancesOf(f.ben.profileId)).toEqual({ vacation: 40, sick: 16 });
  });

  it("approving personal deducts nothing", async () => {
    await setBalances(f.cal.profileId, 40, 24);
    const request = await makeRequest(f, f.cal.profileId, { reason: "personal" });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    await PATCH(patchReq({ decision: "approve" }), { params: Promise.resolve({ requestId: request.id }) });
    expect(await balancesOf(f.cal.profileId)).toEqual({ vacation: 40, sick: 24 });
  });

  it("leaves a NULL bucket untouched (tracking off)", async () => {
    await setBalances(f.ana.profileId, null, 12);
    const request = await makeRequest(f, f.ana.profileId, { reason: "vacation" });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await PATCH(patchReq({ decision: "approve" }), { params: Promise.resolve({ requestId: request.id }) });
    expect(res.status).toBe(200);
    expect(await balancesOf(f.ana.profileId)).toEqual({ vacation: null, sick: 12 });
  });

  it("denying deducts nothing", async () => {
    await setBalances(f.ben.profileId, 40, 24);
    const request = await makeRequest(f, f.ben.profileId, { reason: "vacation" });
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    await PATCH(patchReq({ decision: "deny" }), { params: Promise.resolve({ requestId: request.id }) });
    expect(await balancesOf(f.ben.profileId)).toEqual({ vacation: 40, sick: 24 });
  });

  it("a second approve 409s and does not double-deduct", async () => {
    await setBalances(f.cal.profileId, 40, 24);
    const request = await makeRequest(f, f.cal.profileId, { reason: "vacation" }); // 3 days = 24h
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    await PATCH(patchReq({ decision: "approve" }), { params: Promise.resolve({ requestId: request.id }) });
    const again = await PATCH(patchReq({ decision: "approve" }), { params: Promise.resolve({ requestId: request.id }) });
    expect(again.status).toBe(409);
    expect(await balancesOf(f.cal.profileId)).toEqual({ vacation: 16, sick: 24 });
  });

  it("rejects employees", async () => {
    const request = await makeRequest(f, f.ana.profileId);
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await PATCH(patchReq({ decision: "approve" }), { params: Promise.resolve({ requestId: request.id }) });
    expect(res.status).toBe(403);
  });
});
