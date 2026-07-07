import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { getLocationAvailability } from "@/lib/queries/availability";
import { addDaysISO, weekStartOf } from "@/lib/time";
import { formatWeekOf } from "@/lib/time-format";
import { DatePager } from "@/components/chrome/DatePager";
import { EmptyState } from "@/components/ui/EmptyState";
import { AvailabilityView } from "./AvailabilityView";
import styles from "./availability.module.css";

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ManagerAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  const thisWeek = weekStartOf(new Date(), location.timezone);
  const weekStart = week && WEEK_RE.test(week) ? week : thisWeek;

  const [data, positions] = await Promise.all([
    getLocationAvailability(location.id, weekStart),
    prisma.position.findMany({
      where: { locationId: location.id },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Team availability</h1>
          <div className={styles.subtitle}>
            See who&apos;s available before you build the schedule. Approved time off is shown for this week.
          </div>
        </div>
        <DatePager
          label={formatWeekOf(weekStart)}
          prevHref={`/manager/availability?week=${addDaysISO(weekStart, -7)}`}
          nextHref={`/manager/availability?week=${addDaysISO(weekStart, 7)}`}
          todayHref={`/manager/availability?week=${thisWeek}`}
        />
      </div>

      {data.employees.length === 0 ? (
        <EmptyState
          title="No team members yet"
          description="Invite your team from the Team page to see their availability here."
        />
      ) : (
        <AvailabilityView
          weekStart={weekStart}
          employees={data.employees}
          positions={positions.map((p) => ({ id: p.id, name: p.name }))}
        />
      )}
    </div>
  );
}
