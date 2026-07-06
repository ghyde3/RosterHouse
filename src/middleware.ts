import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { redirectTargetFor } from "@/lib/routes";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const role = req.auth?.user?.role ?? null;
  const target = redirectTargetFor(req.nextUrl.pathname, role ? { role } : null);
  if (target) return Response.redirect(new URL(target, req.nextUrl));
});

export const config = {
  // Skip API routes (handlers return 401 JSON themselves), Next internals,
  // and any file with an extension (static assets).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
