import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ApiError, handleApiError, jsonErr, jsonOk, parseJson } from "@/lib/api";

describe("jsonOk", () => {
  it("wraps data in the ok envelope with status 200", async () => {
    const res = jsonOk({ id: "abc" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { id: "abc" } });
  });

  it("accepts a custom status", () => {
    expect(jsonOk({ id: "abc" }, 201).status).toBe(201);
  });
});

describe("jsonErr", () => {
  it("wraps code and message in the error envelope", async () => {
    const res = jsonErr("not_found", "That location doesn't exist.", 404);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: "not_found", message: "That location doesn't exist." },
    });
  });
});

describe("parseJson", () => {
  const schema = z.object({ name: z.string().min(1, "Enter a name.") });

  function jsonRequest(body: unknown): Request {
    return new Request("http://test.local/api/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns parsed data for valid input", async () => {
    const result = await parseJson(jsonRequest({ name: "Maria" }), schema);
    expect(result.data).toEqual({ name: "Maria" });
    expect(result.error).toBeUndefined();
  });

  it("returns a 400 response naming the invalid field", async () => {
    const result = await parseJson(jsonRequest({ name: "" }), schema);
    expect(result.data).toBeUndefined();
    const res = result.error as Response;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid_input");
    expect(body.error.message).toBe("name: Enter a name.");
  });

  it("returns a 400 response for a non-JSON body", async () => {
    const req = new Request("http://test.local/api/x", { method: "POST", body: "not json" });
    const result = await parseJson(req, schema);
    const res = result.error as Response;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_json");
  });
});

describe("handleApiError", () => {
  it("maps ApiError to its status and code", async () => {
    const res = handleApiError(new ApiError(403, "forbidden", "You don't have access to this location."));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toEqual({ code: "forbidden", message: "You don't have access to this location." });
  });

  it("maps unknown errors to a 500 internal error", async () => {
    const res = handleApiError(new Error("boom"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal");
  });
});
