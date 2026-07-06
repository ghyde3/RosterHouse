import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/authz";
import { POST } from "@/app/api/auth/signup/route";

const createdOrgIds: string[] = [];

function uniqueEmail() {
  return `signup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

function signupRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://test.local/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Jamie Park",
      email: uniqueEmail(),
      password: "rosterhouse1",
      businessName: "Test Harbor",
      locationName: "Downtown",
      timezone: "America/New_York",
      positions: ["Line cook", "Server", "Dishwasher", "Host"],
      ...overrides,
    }),
  });
}

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
  await prisma.$disconnect();
});

describe("POST /api/auth/signup", () => {
  it("creates org, location, positions, and manager in one transaction", async () => {
    const email = uniqueEmail();
    const res = await POST(signupRequest({ email }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    createdOrgIds.push(body.data.organizationId);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user!.role).toBe("manager");
    expect(user!.organizationId).toBe(body.data.organizationId);
    await expect(verifyPassword("rosterhouse1", user!.passwordHash)).resolves.toBe(true);

    const location = await prisma.location.findUnique({ where: { id: body.data.locationId } });
    expect(location!.timezone).toBe("America/New_York");

    const positions = await prisma.position.findMany({
      where: { locationId: body.data.locationId },
      orderBy: { sortOrder: "asc" },
    });
    expect(positions.map((p) => p.name)).toEqual(["Line cook", "Server", "Dishwasher", "Host"]);
  });

  it("rejects a duplicate email with a specific 409", async () => {
    const email = uniqueEmail();
    const first = await POST(signupRequest({ email }));
    const firstBody = await first.json();
    createdOrgIds.push(firstBody.data.organizationId);

    const res = await POST(signupRequest({ email }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("account_exists");
  });

  it("rejects a missing business name with a 400 naming the field", async () => {
    const res = await POST(signupRequest({ businessName: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_input");
    expect(body.error.message).toContain("businessName");
  });

  it("rejects an unknown timezone", async () => {
    const res = await POST(signupRequest({ timezone: "Mars/Olympus" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("timezone");
  });

  it("rejects an unparseable phone with a specific message", async () => {
    const res = await POST(signupRequest({ phone: "12" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_phone");
  });
});
