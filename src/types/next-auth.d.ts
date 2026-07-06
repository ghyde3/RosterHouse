import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "manager" | "employee";
      organizationId: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: "manager" | "employee";
    organizationId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "manager" | "employee";
    organizationId: string;
  }
}
