import type { Metadata } from "next";
import { TemplatesView } from "@/components/manager/TemplatesView";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { getAssignableEmployees } from "@/lib/schedule-data";
import { listTemplates } from "@/lib/template-data";
import { localISODate, weekStartOfISO } from "@/lib/time";

export const metadata: Metadata = { title: "Templates — RosterHouse" };

export default async function TemplatesPage() {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  const [templates, employees] = await Promise.all([
    listTemplates(location.id),
    getAssignableEmployees(location.id),
  ]);
  const currentWeek = weekStartOfISO(localISODate(new Date(), location.timezone));
  return <TemplatesView currentWeek={currentWeek} employees={employees} templates={templates} />;
}
