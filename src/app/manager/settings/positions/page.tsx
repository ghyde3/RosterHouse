import type { Metadata } from "next";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { getPositionsForSettings } from "@/lib/queries/positions";
import { PositionsView } from "@/components/manager/PositionsView";

export const metadata: Metadata = { title: "Positions — RosterHouse" };

export default async function PositionsSettingsPage() {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  const { active, archived } = await getPositionsForSettings(location.id);
  return <PositionsView active={active} archived={archived} />;
}
