import ScheduleView from "@/components/schedule/ScheduleView";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import {
  getAssignableEmployees,
  getMonthShiftCounts,
  getScheduleWeekData,
} from "@/lib/schedule-data";
import {
  addDaysISO,
  localISODate,
  weekStartOfISO,
  type ISODate,
} from "@/lib/time";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SchedulePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  const params = await searchParams;

  const todayISO = localISODate(new Date(), location.timezone);
  const currentWeek = weekStartOfISO(todayISO);

  const rawView = typeof params.view === "string" ? params.view : "week";
  const view = rawView === "day" || rawView === "month" ? rawView : "week";

  // Any non-Monday week param snaps to its Monday; invalid params fall back
  // to the real current week (no demo anchor dates).
  const rawWeek =
    typeof params.week === "string" && ISO_DATE.test(params.week) ? params.week : currentWeek;
  const week = weekStartOfISO(rawWeek);

  const rawDay = typeof params.day === "string" && ISO_DATE.test(params.day) ? params.day : null;
  let day: ISODate = rawDay ?? (week === currentWeek ? todayISO : week);
  if (weekStartOfISO(day) !== week) day = week;

  const month =
    typeof params.month === "string" && ISO_MONTH.test(params.month)
      ? params.month
      : week.slice(0, 7);

  const [data, employees] = await Promise.all([
    getScheduleWeekData(location.id, week),
    getAssignableEmployees(location.id),
  ]);

  let monthCounts: Record<ISODate, number> | null = null;
  if (view === "month") {
    const gridStart = weekStartOfISO(`${month}-01`);
    monthCounts = await getMonthShiftCounts(location.id, gridStart, addDaysISO(gridStart, 41));
  }

  return (
    <ScheduleView
      locationId={location.id}
      currentWeek={currentWeek}
      view={view}
      week={week}
      day={day}
      month={month}
      monthCounts={monthCounts}
      data={data}
      employees={employees}
    />
  );
}
