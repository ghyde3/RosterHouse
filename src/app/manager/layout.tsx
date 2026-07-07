import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ManagerSidebar } from "@/components/chrome/ManagerSidebar";
import { ToasterProvider } from "@/components/ui/Toaster";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireManager();

  let location;
  try {
    location = await getManagerLocation(user.id);
  } catch (err) {
    // A validly-signed session can outlive its user row (e.g. every
    // `prisma db seed` deletes + recreates the org). Route to a handler
    // that actually clears the cookie — redirect("/login") here would
    // leave the "valid" JWT in place and middleware would bounce it
    // straight back to /manager, looping forever.
    if (err instanceof ApiError && err.status === 401) {
      redirect("/signout-stale");
    }
    throw err;
  }

  // The switcher only renders with more than one location, so single-location
  // orgs (the common case) keep the plain location line.
  const locations = await prisma.location.findMany({
    where: { organizationId: location.organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <ToasterProvider>
      <div style={{ display: "flex", minHeight: "100dvh", background: "var(--surface-page)" }}>
        <ManagerSidebar
          locationName={location.name}
          userName={user.name}
          locations={locations}
          activeLocationId={location.id}
        />
        <main style={{ flex: 1, padding: "var(--space-8)", overflow: "auto" }}>{children}</main>
      </div>
    </ToasterProvider>
  );
}
