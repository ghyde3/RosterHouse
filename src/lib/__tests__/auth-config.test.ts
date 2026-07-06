import { describe, it, expect } from "vitest";
import { authConfig } from "@/lib/auth.config";

describe("authConfig", () => {
  it("uses JWT sessions and the /login page", () => {
    expect(authConfig.session?.strategy).toBe("jwt");
    expect(authConfig.pages?.signIn).toBe("/login");
  });

  it("copies id, role, and organizationId onto the JWT at sign-in", async () => {
    const token = await authConfig.callbacks!.jwt!({
      token: { name: "Jamie Park" },
      user: { id: "user_1", name: "Jamie Park", role: "manager", organizationId: "org_1" },
    } as never);
    expect(token).toMatchObject({ id: "user_1", role: "manager", organizationId: "org_1" });
  });

  it("exposes id, role, and organizationId on the session user", async () => {
    const session = await authConfig.callbacks!.session!({
      session: { user: { name: "Jamie Park", email: "jamie@harborvine.test" }, expires: "" },
      token: { id: "user_1", role: "manager", organizationId: "org_1", name: "Jamie Park" },
    } as never);
    expect(session.user).toMatchObject({ id: "user_1", role: "manager", organizationId: "org_1" });
  });
});
