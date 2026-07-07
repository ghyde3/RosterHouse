type RouteUser = { role: "manager" | "employee" };

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/design-system",
  "/signout-stale",
  "/offline", // the service worker precaches this while signed out
];
const EMPLOYEE_PREFIXES = ["/shifts", "/availability", "/clock", "/swaps", "/notifications", "/profile"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true; // public marketing landing page
  if (matchesPrefix(pathname, "/invite")) return true;
  return PUBLIC_PATHS.some((p) => matchesPrefix(pathname, p));
}

export function isEmployeePath(pathname: string): boolean {
  return EMPLOYEE_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

/**
 * The roadmap's redirect rules as a pure function.
 * Returns the path to redirect to, or null to let the request through.
 */
export function redirectTargetFor(pathname: string, user: RouteUser | null): string | null {
  if (!user) return isPublicPath(pathname) ? null : "/login";

  const home = user.role === "manager" ? "/manager" : "/shifts";
  // Signed-in users skip the marketing page and the auth pages.
  if (pathname === "/" || pathname === "/login" || pathname === "/signup") return home;
  if (user.role === "employee" && matchesPrefix(pathname, "/manager")) return "/shifts";
  if (user.role === "manager" && isEmployeePath(pathname)) return "/manager";
  return null;
}
