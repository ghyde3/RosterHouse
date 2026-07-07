import type { Metadata } from "next";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { LocationsView } from "./LocationsView";

export const metadata: Metadata = { title: "Locations — RosterHouse" };

export default async function LocationsSettingsPage() {
  const user = await requireManager();
  const active = await getManagerLocation(user.id);

  const locations = await prisma.location.findMany({
    where: { organizationId: active.organizationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      timezone: true,
      address: true,
      _count: { select: { employees: true } },
    },
  });

  return (
    <LocationsView
      activeLocationId={active.id}
      locations={locations.map((l) => ({
        id: l.id,
        name: l.name,
        timezone: l.timezone,
        address: l.address,
        employeeCount: l._count.employees,
      }))}
    />
  );
}
