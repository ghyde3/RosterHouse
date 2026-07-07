import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/authz";

vi.mock("@/lib/auth", () => ({ apiUser: vi.fn() }));
import { apiUser } from "@/lib/auth";
import { GET as getTeamRoute } from "@/app/api/locations/[locationId]/team/route";
import { PATCH as patchProfile } from "@/app/api/employee-profiles/[id]/route";

const apiUserMock = vi.mocked(apiUser);
const suffix = `team-${Date.now()}`;

let orgId: string;
let locationId: string;
let managerId: string;
let profileId: string;
let serverPositionId: string;
let hostPositionId: string;
let foreignPositionId: string;
let orgId2: string;
let managerId2: string;

function asManager() {
  apiUserMock.mockResolvedValue({ id: managerId, name: "Manager", role: "manager", organizationId: orgId });
}

function params<T extends object>(value: T) {
  return { params: Promise.resolve(value) };
}

function jsonPatch(url: string, body: unknown) {
  return new Request(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `Team Org ${suffix}` } });
  orgId = org.id;
  const location = await prisma.location.create({
    data: { organizationId: org.id, name: "Downtown", timezone: "America/New_York" },
  });
  locationId = location.id;

  const server = await prisma.position.create({ data: { locationId, name: "Server", sortOrder: 0 } });
  const host = await prisma.position.create({ data: { locationId, name: "Host", sortOrder: 1 } });
  serverPositionId = server.id;
  hostPositionId = host.id;

  // A position at a different location in the same org — must be rejected.
  const otherLocation = await prisma.location.create({
    data: { organizationId: org.id, name: "Uptown", timezone: "America/New_York" },
  });
  const foreign = await prisma.position.create({ data: { locationId: otherLocation.id, name: "Server", sortOrder: 0 } });
  foreignPositionId = foreign.id;

  const passwordHash = await hashPassword("rosterhouse1");
  const manager = await prisma.user.create({
    data: { organizationId: org.id, name: "Manager", email: `tm-${suffix}@test.local`, passwordHash, role: "manager" },
  });
  managerId = manager.id;

  const employee = await prisma.user.create({
    data: { organizationId: org.id, name: "Maria Garcia", phone: `+1444${String(Date.now()).slice(-7)}`, passwordHash, role: "employee" },
  });
  const profile = await prisma.employeeProfile.create({
    data: { userId: employee.id, locationId, primaryPositionId: serverPositionId, hourlyRate: "12.50", status: "active" },
  });
  profileId = profile.id;
  await prisma.employeePosition.create({ data: { employeeProfileId: profile.id, positionId: serverPositionId } });

  // Second org for cross-org tests
  const org2 = await prisma.organization.create({ data: { name: `Team Org 2 ${suffix}` } });
  orgId2 = org2.id;
  const manager2 = await prisma.user.create({
    data: { organizationId: org2.id, name: "Manager 2", email: `tm2-${Date.now()}@test.local`, passwordHash, role: "manager" },
  });
  managerId2 = manager2.id;
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgId, orgId2] } } });
  await prisma.$disconnect();
});

describe("GET /api/locations/[locationId]/team", () => {
  it("returns the members with primary position name and numeric rate", async () => {
    asManager();
    const res = await getTeamRoute(new Request(`http://test.local/api/locations/${locationId}/team`), params({ locationId }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const member = body.data.members.find((m: { id: string }) => m.id === profileId);
    expect(member).toMatchObject({
      name: "Maria Garcia",
      status: "active",
      primaryPositionName: "Server",
      positionIds: [serverPositionId],
      hourlyRate: 12.5,
    });
  });

  it("403s employees", async () => {
    apiUserMock.mockResolvedValue({ id: managerId, name: "E", role: "employee", organizationId: orgId });
    const res = await getTeamRoute(new Request(`http://test.local/api/locations/${locationId}/team`), params({ locationId }));
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/employee-profiles/[id]", () => {
  it("updates rate, qualifications, and primary position in one transaction", async () => {
    asManager();
    const res = await patchProfile(
      jsonPatch(`http://test.local/api/employee-profiles/${profileId}`, {
        primaryPositionId: hostPositionId,
        positionIds: [serverPositionId, hostPositionId],
        hourlyRate: 16.5,
      }),
      params({ id: profileId }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.member.primaryPositionId).toBe(hostPositionId);
    expect(body.data.member.hourlyRate).toBe(16.5);
    expect([...body.data.member.positionIds].sort()).toEqual([serverPositionId, hostPositionId].sort());
  });

  it("auto-includes the primary position in the qualification list", async () => {
    asManager();
    const res = await patchProfile(
      jsonPatch(`http://test.local/api/employee-profiles/${profileId}`, {
        primaryPositionId: hostPositionId,
        positionIds: [serverPositionId], // primary missing on purpose
      }),
      params({ id: profileId }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.member.positionIds).toContain(hostPositionId);
  });

  it("rejects a position from another location", async () => {
    asManager();
    const res = await patchProfile(
      jsonPatch(`http://test.local/api/employee-profiles/${profileId}`, { positionIds: [foreignPositionId] }),
      params({ id: profileId }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("position_not_found");
  });

  it("deactivates a member", async () => {
    asManager();
    const res = await patchProfile(
      jsonPatch(`http://test.local/api/employee-profiles/${profileId}`, { status: "inactive" }),
      params({ id: profileId }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.member.status).toBe("inactive");
  });

  it("404s an unknown profile", async () => {
    asManager();
    const res = await patchProfile(
      jsonPatch("http://test.local/api/employee-profiles/nope", { status: "inactive" }),
      params({ id: "nope" }),
    );
    expect(res.status).toBe(404);
  });

  it("sets vacation and sick balances", async () => {
    asManager();
    const res = await patchProfile(
      jsonPatch(`http://test.local/api/employee-profiles/${profileId}`, {
        vacationBalanceHours: 40,
        sickBalanceHours: 16.5,
      }),
      params({ id: profileId }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.member.vacationBalanceHours).toBe(40);
    expect(body.data.member.sickBalanceHours).toBe(16.5);
  });

  it("clears a balance back to null (tracking off) and leaves omitted buckets alone", async () => {
    asManager();
    const res = await patchProfile(
      jsonPatch(`http://test.local/api/employee-profiles/${profileId}`, { vacationBalanceHours: null }),
      params({ id: profileId }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.member.vacationBalanceHours).toBeNull();
    expect(body.data.member.sickBalanceHours).toBe(16.5); // untouched
  });

  it("allows a negative balance but rejects one below the sanity bound", async () => {
    asManager();
    const ok = await patchProfile(
      jsonPatch(`http://test.local/api/employee-profiles/${profileId}`, { sickBalanceHours: -8 }),
      params({ id: profileId }),
    );
    expect(ok.status).toBe(200);
    expect((await ok.json()).data.member.sickBalanceHours).toBe(-8);

    const bad = await patchProfile(
      jsonPatch(`http://test.local/api/employee-profiles/${profileId}`, { vacationBalanceHours: -10001 }),
      params({ id: profileId }),
    );
    expect(bad.status).toBe(400);
  });

  it("403s when a manager from another org attempts to patch", async () => {
    apiUserMock.mockResolvedValue({ id: managerId2, name: "Manager 2", role: "manager", organizationId: orgId2 });
    const res = await patchProfile(
      jsonPatch(`http://test.local/api/employee-profiles/${profileId}`, { status: "inactive" }),
      params({ id: profileId }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("forbidden");
  });
});
