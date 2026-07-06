import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/authz";

vi.mock("@/lib/auth", () => ({ apiUser: vi.fn() }));
import { apiUser } from "@/lib/auth";
import { POST as createInvite } from "@/app/api/locations/[locationId]/invites/route";
import { GET as resolveInvite } from "@/app/api/invites/[token]/route";
import { POST as acceptInvite } from "@/app/api/invites/[token]/accept/route";

const apiUserMock = vi.mocked(apiUser);
const suffix = `invites-${Date.now()}`;

let orgId: string;
let otherOrgId: string;
let locationId: string;
let positionId: string;
let managerId: string;
let otherManagerId: string;

function asManager() {
  apiUserMock.mockResolvedValue({ id: managerId, name: "Manager", role: "manager", organizationId: orgId });
}

function params<T extends object>(value: T) {
  return { params: Promise.resolve(value) };
}

function jsonPost(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `Invite Org ${suffix}` } });
  const otherOrg = await prisma.organization.create({ data: { name: `Other Org ${suffix}` } });
  orgId = org.id;
  otherOrgId = otherOrg.id;
  const location = await prisma.location.create({
    data: { organizationId: org.id, name: "Downtown", timezone: "America/New_York" },
  });
  locationId = location.id;
  const position = await prisma.position.create({ data: { locationId, name: "Server" } });
  positionId = position.id;
  const passwordHash = await hashPassword("rosterhouse1");
  const manager = await prisma.user.create({
    data: { organizationId: org.id, name: "Manager", email: `mgr-${suffix}@test.local`, passwordHash, role: "manager" },
  });
  managerId = manager.id;
  const otherManager = await prisma.user.create({
    data: { organizationId: otherOrg.id, name: "Other", email: `other-${suffix}@test.local`, passwordHash, role: "manager" },
  });
  otherManagerId = otherManager.id;
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
  await prisma.$disconnect();
});

describe("POST /api/locations/[locationId]/invites", () => {
  it("creates a pending invite with a copyable link", async () => {
    asManager();
    const res = await createInvite(
      jsonPost(`http://test.local/api/locations/${locationId}/invites`, {
        name: "Riley Quinn",
        contact: "(555) 010-2222",
        positionId,
      }),
      params({ locationId }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.inviteUrl).toBe(`http://test.local/invite/${body.data.token}`);

    const invite = await prisma.invite.findUnique({ where: { token: body.data.token } });
    expect(invite!.status).toBe("pending");
    expect(invite!.phone).toBe("+15550102222");
    expect(invite!.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 13 * 24 * 60 * 60 * 1000);
  });

  it("returns 401 when signed out", async () => {
    apiUserMock.mockResolvedValue(null);
    const res = await createInvite(
      jsonPost(`http://test.local/api/locations/${locationId}/invites`, { name: "A", contact: "a@b.co", positionId }),
      params({ locationId }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for employees", async () => {
    apiUserMock.mockResolvedValue({ id: managerId, name: "E", role: "employee", organizationId: orgId });
    const res = await createInvite(
      jsonPost(`http://test.local/api/locations/${locationId}/invites`, { name: "A", contact: "a@b.co", positionId }),
      params({ locationId }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 for a manager from another org (tenancy)", async () => {
    apiUserMock.mockResolvedValue({ id: otherManagerId, name: "Other", role: "manager", organizationId: otherOrgId });
    const res = await createInvite(
      jsonPost(`http://test.local/api/locations/${locationId}/invites`, { name: "A", contact: "a@b.co", positionId }),
      params({ locationId }),
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /api/invites/[token]", () => {
  it("resolves a pending invite for the landing page", async () => {
    asManager();
    const created = await createInvite(
      jsonPost(`http://test.local/api/locations/${locationId}/invites`, {
        name: "Casey Fox",
        contact: `casey-${suffix}@test.local`,
        positionId,
      }),
      params({ locationId }),
    );
    const { data } = await created.json();
    const res = await resolveInvite(new Request(`http://test.local/api/invites/${data.token}`), params({ token: data.token }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      locationName: "Downtown",
      inviterName: "Manager",
      positionName: "Server",
      inviteeName: "Casey Fox",
      status: "pending",
    });
  });

  it("404s an unknown token", async () => {
    const res = await resolveInvite(new Request("http://test.local/api/invites/nope"), params({ token: "nope" }));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/invites/[token]/accept", () => {
  async function freshInvite() {
    asManager();
    const created = await createInvite(
      jsonPost(`http://test.local/api/locations/${locationId}/invites`, {
        name: "New Hire",
        contact: `hire-${Date.now()}@test.local`,
        positionId,
      }),
      params({ locationId }),
    );
    const { data } = await created.json();
    return data.token as string;
  }

  it("creates user, profile, and qualification in one transaction, then marks the invite accepted", async () => {
    const token = await freshInvite();
    const phone = `+1777${String(Date.now()).slice(-7)}`;
    const res = await acceptInvite(
      jsonPost(`http://test.local/api/invites/${token}/accept`, { name: "New Hire", phone, password: "rosterhouse1" }),
      params({ token }),
    );
    expect(res.status).toBe(201);

    const user = await prisma.user.findFirst({ where: { phone } });
    expect(user!.role).toBe("employee");
    expect(user!.organizationId).toBe(orgId);
    await expect(verifyPassword("rosterhouse1", user!.passwordHash)).resolves.toBe(true);

    const profile = await prisma.employeeProfile.findFirst({ where: { userId: user!.id } });
    expect(profile!.locationId).toBe(locationId);
    expect(profile!.primaryPositionId).toBe(positionId);
    expect(profile!.status).toBe("active");

    const qualifications = await prisma.employeePosition.findMany({ where: { employeeProfileId: profile!.id } });
    expect(qualifications.map((q) => q.positionId)).toEqual([positionId]);

    const invite = await prisma.invite.findUnique({ where: { token } });
    expect(invite!.status).toBe("accepted");
  });

  it("410s a second acceptance of the same invite", async () => {
    const token = await freshInvite();
    const phone = `+1888${String(Date.now()).slice(-7)}`;
    await acceptInvite(
      jsonPost(`http://test.local/api/invites/${token}/accept`, { name: "A", phone, password: "rosterhouse1" }),
      params({ token }),
    );
    const res = await acceptInvite(
      jsonPost(`http://test.local/api/invites/${token}/accept`, { name: "B", phone: `+1889${String(Date.now()).slice(-7)}`, password: "rosterhouse1" }),
      params({ token }),
    );
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error.code).toBe("invite_used");
  });

  it("409s a phone number that is already on an account", async () => {
    const firstToken = await freshInvite();
    const secondToken = await freshInvite();
    const phone = `+1666${String(Date.now()).slice(-7)}`;

    const first = await acceptInvite(
      jsonPost(`http://test.local/api/invites/${firstToken}/accept`, { name: "First", phone, password: "rosterhouse1" }),
      params({ token: firstToken }),
    );
    expect(first.status).toBe(201);

    const res = await acceptInvite(
      jsonPost(`http://test.local/api/invites/${secondToken}/accept`, { name: "Second", phone, password: "rosterhouse1" }),
      params({ token: secondToken }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("phone_taken");
  });

  it("400s an unparseable phone", async () => {
    const token = await freshInvite();
    const res = await acceptInvite(
      jsonPost(`http://test.local/api/invites/${token}/accept`, { name: "A", phone: "12", password: "rosterhouse1" }),
      params({ token }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_phone");
  });
});
