import type { NextAuthConfig, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

/**
 * Edge-safe Auth.js config: no Prisma, no bcrypt. src/middleware.ts builds
 * its own NextAuth(authConfig) from this to decode the session JWT;
 * src/lib/auth.ts spreads it and adds the Credentials provider.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true, // Railway/localhost are not Vercel; hosts come from env
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.organizationId = user.organizationId;
      }
      return token;
    },
    session({ session, token }: { session: Session; token: JWT }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.organizationId = token.organizationId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
