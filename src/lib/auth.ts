import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { authConfig } from "@/lib/auth.config";
import { authenticateUser } from "@/lib/authz";

export type SessionUser = {
  id: string;
  name: string;
  role: "manager" | "employee";
  organizationId: string;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Phone or email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = typeof credentials?.identifier === "string" ? credentials.identifier : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!identifier || !password) return null;

        const user = await authenticateUser(identifier, password);
        if (!user) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),
  ],
});

/** For server components/layouts: redirects to /login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id, name, role, organizationId } = session.user;
  return { id, name: name ?? "", role, organizationId };
}

/** For manager pages: employees are sent to their home ("/shifts"). */
export async function requireManager(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "manager") redirect("/shifts");
  return user;
}

/** For API route handlers: no redirect — handlers return a 401 envelope on null. */
export async function apiUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const { id, name, role, organizationId } = session.user;
  return { id, name: name ?? "", role, organizationId };
}
