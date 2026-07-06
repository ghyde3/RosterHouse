import { Fragment } from "react";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { getLocationAvailability, type OverviewDay } from "@/lib/queries/availability";
import { addDaysISO, formatDayLabel, weekDatesOf, weekStartOf } from "@/lib/time";
import { formatWeekOf, hhmmTo12h } from "@/lib/time-format";
import { DatePager } from "@/components/chrome/DatePager";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
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

  const data = await getLocationAvailability(location.id, weekStart);
  const dates = weekDatesOf(weekStart);

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
        <div className={styles.gridWrap}>
          <div className={styles.grid}>
            <div />
            {dates.map((d) => (
              <div key={d} className={styles.dayHead}>
                {formatDayLabel(d)}
              </div>
            ))}
            {data.employees.map((e) => (
              <Fragment key={e.profileId}>
                <div className={styles.person}>
                  <Avatar name={e.name} size={28} />
                  <div>
                    <div className={styles.personName}>{e.name}</div>
                    {e.primaryPositionName && (
                      <div className={styles.personRole}>{e.primaryPositionName}</div>
                    )}
                  </div>
                </div>
                {e.days.map((day) => (
                  <AvailabilityCell key={day.date} day={day} />
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AvailabilityCell({ day }: { day: OverviewDay }) {
  if (day.timeOff) {
    return <div className={`${styles.cell} ${styles.cellTimeOff}`}>Time off</div>;
  }
  if (!day.isAvailable) {
    return <div className={`${styles.cell} ${styles.cellOff}`}>Unavailable</div>;
  }
  if (day.startTime && day.endTime) {
    return (
      <div className={`${styles.cell} ${styles.cellOn}`}>
        {hhmmTo12h(day.startTime)} – {hhmmTo12h(day.endTime)}
      </div>
    );
  }
  return <div className={`${styles.cell} ${styles.cellOn}`}>All day</div>;
}
