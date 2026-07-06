import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/authz";

describe("hashPassword / verifyPassword", () => {
  it("produces a bcrypt hash that does not contain the plain text", async () => {
    const hash = await hashPassword("rosterhouse1");
    expect(hash).not.toContain("rosterhouse1");
    expect(hash.startsWith("$2")).toBe(true); // bcrypt marker
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword("rosterhouse1");
    await expect(verifyPassword("rosterhouse1", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("rosterhouse1");
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("salts: two hashes of the same password differ", async () => {
    const [a, b] = await Promise.all([hashPassword("rosterhouse1"), hashPassword("rosterhouse1")]);
    expect(a).not.toBe(b);
  });
});
