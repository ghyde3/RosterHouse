import type { Metadata } from "next";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { getAuditLogs } from "@/lib/audit";
import { ActivityList } from "./ActivityList";

export const metadata: Metadata = { title: "Activity — RosterHouse" };

export default async function ActivitySettingsPage() {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  const first = await getAuditLogs(user.organizationId, { locationId: location.id, limit: 30 });
  return <ActivityList locationId={location.id} timezone={location.timezone} initial={first} />;
}
