import type { Metadata } from "next";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { LocationSettingsForm } from "./LocationSettingsForm";

export const metadata: Metadata = { title: "Settings — RosterHouse" };

export default async function SettingsLocationPage() {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  return (
    <LocationSettingsForm
      locationId={location.id}
      name={location.name}
      timezone={location.timezone}
      overtimeHoursPerWeek={location.overtimeHoursPerWeek}
      minRestHours={location.minRestHours}
      maxConsecutiveDays={location.maxConsecutiveDays}
      address={location.address}
    />
  );
}
