import { signOut } from "@/lib/auth";

/**
 * Clears a valid-but-orphaned session cookie (e.g. after `prisma db seed`
 * recreates users with new ids) and sends the browser to /login.
 *
 * This must be a route handler (not a redirect() from a layout) because
 * only route handlers/actions can set the Set-Cookie header that actually
 * invalidates the JWT cookie. A plain redirect("/login") would leave the
 * stale cookie in place, and middleware would immediately bounce the still
 * "valid" session back to /manager — an infinite loop.
 */
export async function GET() {
  return signOut({ redirectTo: "/login" });
}
