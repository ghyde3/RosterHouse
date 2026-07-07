// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The real driver module imports the Twilio/web-push drivers, which are being
// built on a parallel track and may not exist in this tree yet. The contract
// only requires that the request route calls defaultDriver().sendSms — mock
// the module boundary and assert on the spy.
const sendSms = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/notify/driver", () => ({
  defaultDriver: () => ({ sendSms, sendPush: vi.fn(async () => {}) }),
}));

import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/authz";
import { createPasswordReset, getPasswordResetByToken, PASSWORD_RESET_TTL_MS } from "@/lib/password-reset";
import { POST as requestReset } from "@/app/api/auth/password-reset/request/route";
import { POST as confirmReset } from "@/app/api/auth/password-reset/confirm/route";
import { createTestOrg, createTestEmployee, deleteTestOrg, type TestOrg } from "@/lib/test/factories";

function requestReq(identifier: unknown) {
  return new Request("http://test/api/auth/password-reset/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  });
}

function confirmReq(body: unknown) {
  return new Request("http://test/api/auth/password-reset/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function orgTokenCount(organizationId: string) {
  return prisma.passwordResetToken.count({ where: { user: { organizationId } } });
}

describe("password reset API", () => {
  let org: TestOrg;
  let managerEmail: string;
  let employeeUserId: string;
  const phoneDigits = `555${String(Date.now()).slice(-7)}`; // unique-enough 10 digits
  const employeePhone = `+1${phoneDigits}`;

  beforeAll(async () => {
    delete process.env.RESEND_API_KEY; // email must fall back to console
    org = await createTestOrg();
    const manager = await prisma.user.findUniqueOrThrow({ where: { id: org.managerUserId } });
    managerEmail = manager.email!;
    const employee = await createTestEmployee(org, "Pat Reset");
    employeeUserId = employee.userId;
    await prisma.user.update({ where: { id: employeeUserId }, data: { phone: employeePhone } });
  });

  afterAll(async () => {
    await deleteTestOrg(org.organizationId);
  });

  it("returns ok for an unknown identifier and creates no token", async () => {
    const res = await requestReset(requestReq(`nobody-${Date.now()}@test.local`));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ requested: true });
    expect(await orgTokenCount(org.organizationId)).toBe(0);
  });

  it("returns ok for an unparseable phone and creates no token", async () => {
    const res = await requestReset(requestReq("123"));
    expect((await res.json()).ok).toBe(true);
    expect(await orgTokenCount(org.organizationId)).toBe(0);
  });

  it("rejects an empty identifier with 400 invalid_input", async () => {
    const res = await requestReset(requestReq("   "));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_input");
  });

  it("creates a token for an email match (case-insensitive) and still returns the generic ok", async () => {
    const res = await requestReset(requestReq(managerEmail.toUpperCase()));
    expect((await res.json()).data).toEqual({ requested: true });

    const row = await prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: org.managerUserId },
    });
    expect(row.usedAt).toBeNull();
    const ttl = row.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(PASSWORD_RESET_TTL_MS - 60_000);
    expect(ttl).toBeLessThanOrEqual(PASSWORD_RESET_TTL_MS);
  });

  it("creates a token for a phone match and sends the link over SMS", async () => {
    sendSms.mockClear();
    const formatted = `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`;
    const res = await requestReset(requestReq(formatted));
    expect((await res.json()).data).toEqual({ requested: true });

    const row = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: employeeUserId } });
    expect(sendSms).toHaveBeenCalledTimes(1);
    const [to, body] = sendSms.mock.calls[0] as unknown as [string, string];
    expect(to).toBe(employeePhone);
    expect(body).toContain(`/reset-password/${row.token}`);
    expect(body).toContain("expires in 1 hour");
  });

  it("confirms a reset: password changes, token is used, other outstanding tokens are invalidated", async () => {
    const target = await createPasswordReset(employeeUserId);
    const bystander = await createPasswordReset(employeeUserId);

    const res = await confirmReset(confirmReq({ token: target.token, password: "brand-new-pass-1" }));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ reset: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: employeeUserId } });
    expect(await verifyPassword("brand-new-pass-1", user.passwordHash)).toBe(true);

    const targetRow = await prisma.passwordResetToken.findUniqueOrThrow({ where: { token: target.token } });
    expect(targetRow.usedAt).not.toBeNull();
    const bystanderRow = await prisma.passwordResetToken.findUniqueOrThrow({ where: { token: bystander.token } });
    expect(bystanderRow.usedAt).not.toBeNull();
  });

  it("returns 404 reset_not_found for an unknown token", async () => {
    const res = await confirmReset(confirmReq({ token: "not-a-real-token", password: "whatever-123" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("reset_not_found");
  });

  it("returns 410 reset_used when the same token is confirmed twice", async () => {
    const { token } = await createPasswordReset(employeeUserId);
    const first = await confirmReset(confirmReq({ token, password: "first-pass-123" }));
    expect(first.status).toBe(200);

    const second = await confirmReset(confirmReq({ token, password: "second-pass-123" }));
    expect(second.status).toBe(410);
    expect((await second.json()).error.code).toBe("reset_used");
  });

  it("returns 410 reset_expired for an expired token", async () => {
    const row = await prisma.passwordResetToken.create({
      data: {
        userId: employeeUserId,
        token: `expired-${Date.now()}`,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const res = await confirmReset(confirmReq({ token: row.token, password: "late-pass-1234" }));
    expect(res.status).toBe(410);
    expect((await res.json()).error.code).toBe("reset_expired");
  });

  it("resolves tokens for the reset page: valid, used, expired, and missing", async () => {
    expect(await getPasswordResetByToken("no-such-token")).toBeNull();

    const { token } = await createPasswordReset(employeeUserId);
    expect(await getPasswordResetByToken(token)).toEqual({ status: "valid", userName: "Pat Reset" });

    await prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } });
    expect(await getPasswordResetByToken(token)).toEqual({ status: "used", userName: "Pat Reset" });

    const expired = await prisma.passwordResetToken.create({
      data: {
        userId: employeeUserId,
        token: `expired-resolve-${Date.now()}`,
        expiresAt: new Date(Date.now() - 1),
      },
    });
    expect(await getPasswordResetByToken(expired.token)).toEqual({ status: "expired", userName: "Pat Reset" });
  });

  it("rejects a short password with 400 invalid_input before touching the token", async () => {
    const { token } = await createPasswordReset(employeeUserId);
    const res = await confirmReset(confirmReq({ token, password: "short" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_input");

    const row = await prisma.passwordResetToken.findUniqueOrThrow({ where: { token } });
    expect(row.usedAt).toBeNull();
  });

  it("still returns the generic ok and creates a token when SMS delivery fails", async () => {
    sendSms.mockClear();
    sendSms.mockRejectedValueOnce(new Error("twilio is down"));
    const before = await prisma.passwordResetToken.count({ where: { userId: employeeUserId } });

    const res = await requestReset(requestReq(employeePhone));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ requested: true });

    // Delivery was attempted and failed, yet the token row still exists —
    // a failure must be indistinguishable from success (no enumeration).
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(await prisma.passwordResetToken.count({ where: { userId: employeeUserId } })).toBe(before + 1);
  });
});
