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
import { POST } from "@/app/api/time-off/route";
import { GET } from "@/app/api/locations/[locationId]/time-off/route";
import { createFixture, destroyFixture, isoDateFromNow, type Fixture } from "./helpers/factory";
import { signInAs } from "./helpers/auth";

function postReq(body: unknown): Request {
  return new Request("http://test/api/time-off", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/time-off", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("creates a pending request for the signed-in employee", async () => {
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId, name: f.ana.name });
    const start = isoDateFromNow(7, f.timezone);
    const end = isoDateFromNow(9, f.timezone);
    const res = await POST(postReq({ startDate: start, endDate: end, reason: "vacation" }));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("pending");
    const row = await prisma.timeOffRequest.findUnique({ where: { id: json.data.id } });
    expect(row?.employeeProfileId).toBe(f.ana.profileId);
  });

  it("rejects endDate before startDate with a specific message", async () => {
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await POST(
      postReq({ startDate: isoDateFromNow(9, f.timezone), endDate: isoDateFromNow(7, f.timezone), reason: "vacation" }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.message).toBe("End date must be on or after the start date.");
  });

  it("requires a note when reason is other", async () => {
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const d = isoDateFromNow(7, f.timezone);
    const res = await POST(postReq({ startDate: d, endDate: d, reason: "other" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toBe("Tell your manager why you need this time off.");
  });

  it("rejects signed-out callers", async () => {
    const { signOutAll } = await import("./helpers/auth");
    signOutAll();
    const d = isoDateFromNow(7, f.timezone);
    const res = await POST(postReq({ startDate: d, endDate: d, reason: "sick" }));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/locations/[locationId]/time-off", () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
    await prisma.timeOffRequest.create({
      data: {
        employeeProfileId: f.ben.profileId,
        startDate: new Date(isoDateFromNow(10, f.timezone)),
        endDate: new Date(isoDateFromNow(11, f.timezone)),
        reason: "personal",
      },
    });
  });
  afterAll(async () => {
    await destroyFixture(f);
  });

  it("returns pending requests with names and range labels to the manager", async () => {
    signInAs(f.managerUserId, { role: "manager", organizationId: f.orgId });
    const res = await GET(new Request(`http://test/api/locations/${f.locationId}/time-off?status=pending`), {
      params: Promise.resolve({ locationId: f.locationId }),
    });
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.requests).toHaveLength(1);
    expect(json.data.requests[0].employeeName).toBe("Ben Cho");
    expect(json.data.requests[0].rangeLabel).toContain("–");
    expect(json.data.requests[0].status).toBe("pending");
  });

  it("rejects employees", async () => {
    signInAs(f.ana.userId, { role: "employee", organizationId: f.orgId });
    const res = await GET(new Request(`http://test/api/locations/${f.locationId}/time-off`), {
      params: Promise.resolve({ locationId: f.locationId }),
    });
    expect(res.status).toBe(403);
  });
});
