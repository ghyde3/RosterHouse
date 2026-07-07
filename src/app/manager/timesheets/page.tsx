import type { Metadata } from "next";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { getTimesheetWeekData } from "@/lib/timesheet-data";
import { addDaysISO, localISODate, weekStartOfISO } from "@/lib/time";
import { formatWeekOf } from "@/lib/time-format";
import { TimesheetsView } from "@/components/manager/TimesheetsView";

export const metadata: Metadata = { title: "Timesheets — RosterHouse" };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const user = await requireManager();
  const location = await getManagerLocation(user.id);

  const todayISO = localISODate(new Date(), location.timezone);
  const currentWeek = weekStartOfISO(todayISO);
  const rawWeek = week && ISO_DATE.test(week) ? week : currentWeek;
  const weekStart = weekStartOfISO(rawWeek);

  const data = await getTimesheetWeekData(location.id, weekStart);

  return (
    <TimesheetsView
      locationId={location.id}
      weekStart={weekStart}
      weekLabel={formatWeekOf(weekStart)}
      prevHref={`/manager/timesheets?week=${addDaysISO(weekStart, -7)}`}
      nextHref={`/manager/timesheets?week=${addDaysISO(weekStart, 7)}`}
      todayHref="/manager/timesheets"
      data={data}
    />
  );
}
