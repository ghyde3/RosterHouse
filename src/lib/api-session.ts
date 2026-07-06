// Session accessor for API route handlers. Pages use requireUser()/
// requireManager() (which redirect); API handlers must return JSON errors
// instead, so they null-check this and reply 401/403 themselves.
import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  name: string;
  role: "manager" | "employee";
  organizationId: string;
};

export async function sessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user as Partial<SessionUser> | undefined;
  if (!user?.id || !user.role || !user.organizationId) return null;
  return user as SessionUser;
}
