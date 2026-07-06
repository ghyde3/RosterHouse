// src/app/(employee)/shifts/page.tsx — the employee home at "/shifts"
import { requireUser } from "@/lib/auth";
import { getEmployeeContext, getMyShifts } from "@/lib/queries/employee";
import { addDaysISO, formatDurationHrs, weekStartOf } from "@/lib/time";
import { dayLabelWithToday, todayISOIn } from "@/lib/time-format";
import { PageTopBar } from "@/components/employee/PageTopBar";
import { ShiftCard } from "@/components/employee/ShiftCard";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default async function HomePage() {
  const user = await requireUser();
  const ctx = await getEmployeeContext(user.id);
  if (!ctx) throw new Error("No employee profile is linked to this account.");

  const now = new Date();
  const weekStart = weekStartOf(now, ctx.timezone);
  const weekEnd = addDaysISO(weekStart, 6);
  const todayISO = todayISOIn(ctx.timezone, now);

  // Summary = this week; list horizon = this week + next.
  const week = await getMyShifts(ctx.profileId, weekStart, weekEnd, ctx.timezone);
  const horizon = await getMyShifts(ctx.profileId, weekStart, addDaysISO(weekStart, 13), ctx.timezone);
  const upcoming = horizon.shifts.filter((s) => new Date(s.endsAt).getTime() > now.getTime());

  const { shiftCount, totalHours } = week.summary;

  return (
    <div className={styles.screen}>
      <PageTopBar title={`Hi, ${ctx.firstName}`} />

      {shiftCount > 0 && (
        <section className={styles.summaryCard}>
          <div className={styles.summaryTitle}>You&apos;re all set for this week.</div>
          <div className={styles.summarySub}>
            {shiftCount} {shiftCount === 1 ? "shift" : "shifts"} · {formatDurationHrs(totalHours)} total
          </div>
        </section>
      )}

      <h2 className={styles.sectionTitle}>Upcoming shifts</h2>

      {upcoming.length === 0 ? (
        shiftCount === 0 ? (
          <EmptyState
            title="No shifts yet"
            description="Your manager hasn't published this week."
          />
        ) : (
          <div className={styles.muted}>No more shifts this week.</div>
        )
      ) : (
        upcoming.map((s) => (
          <ShiftCard
            key={s.id}
            href={`/shifts/${s.id}`}
            dayLabel={dayLabelWithToday(s.date, todayISO)}
            positionName={s.positionName}
            timeRange={s.timeRange}
            badgeTone="success"
            badgeLabel="Confirmed"
          />
        ))
      )}
    </div>
  );
}
