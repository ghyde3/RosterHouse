import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { vi } from "vitest";

const mockSession = vi.hoisted(() => ({
  current: null as null | { user: { id: string; name: string; role: "manager" | "employee"; organizationId: string } },
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => mockSession.current) }));

import { GET as listTemplatesRoute, POST as createTemplateRoute } from "@/app/api/schedule-templates/route";
import {
  DELETE as deleteTemplateRoute,
  GET as getTemplateRoute,
  PATCH as patchTemplateRoute,
} from "@/app/api/schedule-templates/[templateId]/route";
import { createFixture, createShiftAt, destroyFixture, type Fixture } from "./helpers/factory";
import { localToUtc, weekStartOf } from "@/lib/time";

let f: Fixture;

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://test/api/schedule-templates", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  f = await createFixture();
  mockSession.current = {
    user: { id: f.managerUserId, name: f.managerName, role: "manager", organizationId: f.orgId },
  };
});
afterAll(async () => {
  await destroyFixture(f);
});

describe("POST /api/schedule-templates", () => {
  it("creates from explicit rows and returns the detail", async () => {
    const res = await createTemplateRoute(
      jsonRequest("POST", {
        name: "From rows",
        rows: [{ positionId: f.positionIds.server, employeeProfileId: null, dayOfWeek: 0, startTime: "9:00 AM", endTime: "5:00 PM" }],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.template.rows).toHaveLength(1);
  });

  it("creates by snapshotting a week", async () => {
    const week = weekStartOf(new Date(), f.timezone);
    await createShiftAt(f, {
      positionId: f.positionIds.server,
      employeeProfileId: f.ana.profileId,
      startsAt: localToUtc(week, { hour: 8, minute: 0 }, f.timezone),
      endsAt: localToUtc(week, { hour: 16, minute: 0 }, f.timezone),
    });
    const res = await createTemplateRoute(jsonRequest("POST", { name: "From week", fromWeek: week }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.template.rows.length).toBeGreaterThanOrEqual(1);
  });

  it("409s on a duplicate name", async () => {
    await createTemplateRoute(jsonRequest("POST", { name: "Dup api", rows: [] }));
    const res = await createTemplateRoute(jsonRequest("POST", { name: "Dup api", rows: [] }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("name_taken");
  });

  it("401s when signed out", async () => {
    const saved = mockSession.current;
    mockSession.current = null;
    const res = await createTemplateRoute(jsonRequest("POST", { name: "Nope", rows: [] }));
    expect(res.status).toBe(401);
    mockSession.current = saved;
  });
});

describe("GET/PATCH/DELETE /api/schedule-templates/[templateId]", () => {
  async function createOne(name: string): Promise<string> {
    const res = await createTemplateRoute(jsonRequest("POST", { name, rows: [] }));
    return (await res.json()).data.template.id;
  }

  it("gets, renames, and deletes", async () => {
    const id = await createOne("Lifecycle");
    const getRes = await getTemplateRoute(new Request("http://test"), { params: Promise.resolve({ templateId: id }) });
    expect((await getRes.json()).data.template.name).toBe("Lifecycle");

    const patchRes = await patchTemplateRoute(jsonRequest("PATCH", { name: "Lifecycle 2" }), {
      params: Promise.resolve({ templateId: id }),
    });
    expect((await patchRes.json()).data.template.name).toBe("Lifecycle 2");

    const delRes = await deleteTemplateRoute(new Request("http://test", { method: "DELETE" }), {
      params: Promise.resolve({ templateId: id }),
    });
    expect((await delRes.json()).data.deleted).toBe(true);

    const missRes = await deleteTemplateRoute(new Request("http://test", { method: "DELETE" }), {
      params: Promise.resolve({ templateId: id }),
    });
    expect(missRes.status).toBe(404);
  });

  it("404s a template from another location (tenancy)", async () => {
    const other = await createFixture();
    const savedSession = mockSession.current;
    try {
      // Create a template owned by `other`'s manager, then switch back to f's manager.
      mockSession.current = {
        user: { id: other.managerUserId, name: other.managerName, role: "manager", organizationId: other.orgId },
      };
      const createRes = await createTemplateRoute(jsonRequest("POST", { name: "Foreign api", rows: [] }));
      const foreignId = (await createRes.json()).data.template.id;
      mockSession.current = savedSession;

      const res = await getTemplateRoute(new Request("http://test"), {
        params: Promise.resolve({ templateId: foreignId }),
      });
      expect(res.status).toBe(404);
    } finally {
      mockSession.current = savedSession;
      await destroyFixture(other);
    }
  });
});
