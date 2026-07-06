import { Suspense } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConflictChip } from "@/components/ui/ConflictChip";
import { StatCard } from "@/components/ui/StatCard";
import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { getDashboardData } from "@/lib/dashboard-data";
import { localTimeOfDay } from "@/lib/time";
import styles from "./dashboard.module.css";

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function ManagerDashboardPage() {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);
  const { hour } = localTimeOfDay(new Date(), location.timezone);
  const firstName = user.name.split(" ")[0];

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>
        {greetingFor(hour)}, {firstName}
      </h1>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent locationId={location.id} timezone={location.timezone} />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className={styles.statRow}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skeletonStat} />
        ))}
      </div>
      <div className={styles.cardRow}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skeletonCard} />
        ))}
      </div>
    </>
  );
}

async function DashboardContent({
  locationId,
  timezone,
}: {
  locationId: string;
  timezone: string;
}) {
  const data = await getDashboardData(locationId, timezone);

  return (
    <>
      <div className={styles.statRow}>
        {/* StatCard tone is a CSS color token string (inline color) — omit for neutral. */}
        <StatCard
          label="Open shifts this week"
          value={String(data.openShiftsThisWeek)}
          tone={data.openShiftsThisWeek > 0 ? "var(--status-warning)" : undefined}
        />
        <StatCard label="Pending requests" value={String(data.pendingRequests)} />
        <StatCard label="Projected labor cost" value={data.projectedLaborCost} />
        <StatCard
          label="Clocked in now"
          value={String(data.clockedInNow.length)}
          tone={data.clockedInNow.length > 0 ? "var(--status-success)" : undefined}
        />
      </div>

      <div className={styles.cardRow}>
        <Link href="/manager/schedule" className={styles.cardLink}>
          <Card hoverable>
            {data.conflictCountThisWeek > 0 ? (
              <>
                <div className={styles.cardTitle}>
                  {data.conflictCountThisWeek === 1
                    ? "1 shift has a conflict"
                    : `${data.conflictCountThisWeek} shifts have conflicts`}
                </div>
                <div className={styles.cardBody}>
                  Resolve before you publish this week&apos;s schedule.
                </div>
                <div className={styles.cardMeta}>
                  <ConflictChip>View in the schedule builder</ConflictChip>
                </div>
              </>
            ) : (
              <>
                <div className={styles.cardTitle}>No conflicts this week</div>
                <div className={styles.cardBody}>Open the schedule builder to plan ahead.</div>
              </>
            )}
          </Card>
        </Link>

        <Link href="/manager/time-off" className={styles.cardLink}>
          <Card hoverable>
            {data.pendingTimeOff > 0 ? (
              <>
                <div className={styles.cardTitle}>
                  {data.pendingTimeOff === 1
                    ? "1 time-off request waiting"
                    : `${data.pendingTimeOff} time-off requests waiting`}
                </div>
                <div className={styles.cardBody}>Employees are waiting on a decision.</div>
                <div className={styles.cardMeta}>
                  <Badge tone="warning">Needs review</Badge>
                </div>
              </>
            ) : (
              <>
                <div className={styles.cardTitle}>No time-off requests waiting</div>
                <div className={styles.cardBody}>New requests will show up here.</div>
              </>
            )}
          </Card>
        </Link>

        <Link href="/manager/swaps" className={styles.cardLink}>
          <Card hoverable>
            {data.pendingSwaps + data.pendingClaims > 0 ? (
              <>
                <div className={styles.cardTitle}>
                  {data.pendingSwaps + data.pendingClaims === 1
                    ? "1 swap or claim to review"
                    : `${data.pendingSwaps + data.pendingClaims} swaps and claims to review`}
                </div>
                <div className={styles.cardBody}>Shift swaps and open-shift claims need approval.</div>
                <div className={styles.cardMeta}>
                  <Badge tone="info">Needs review</Badge>
                </div>
              </>
            ) : (
              <>
                <div className={styles.cardTitle}>No swaps or claims waiting</div>
                <div className={styles.cardBody}>Swap requests and claims will show up here.</div>
              </>
            )}
          </Card>
        </Link>
      </div>

      <h2 className={styles.sectionHeading}>Clocked in now</h2>
      {data.clockedInNow.length === 0 ? (
        <p className={styles.emptyText}>No one is clocked in right now.</p>
      ) : (
        <div className={styles.clockRow}>
          {data.clockedInNow.map((entry) => (
            <Card key={entry.name}>
              <div className={styles.cardTitle}>{entry.name}</div>
              <div className={styles.cardBody}>{entry.positionName ?? "No primary position"}</div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
