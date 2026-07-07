import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEmployeeContext, getEmployeeShiftDetail } from "@/lib/queries/employee";
import { formatDurationHrs } from "@/lib/time";
import { SWAPS_ENABLED } from "@/lib/flags";
import { PageTopBar } from "@/components/employee/PageTopBar";
import { RequestSwapButton } from "@/components/employee/RequestSwapButton";
import { DropRequestButton } from "@/components/employee/DropRequestButton";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import styles from "@/components/employee/employee.module.css";

export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ shiftId: string }>;
}) {
  const { shiftId } = await params;
  const user = await requireUser();
  const ctx = await getEmployeeContext(user.id);
  if (!ctx) throw new Error("No employee profile is linked to this account.");

  const shift = await getEmployeeShiftDetail(
    { profileId: ctx.profileId, locationId: ctx.locationId, timezone: ctx.timezone },
    shiftId
  );
  if (!shift) notFound();

  return (
    <div className={styles.screen}>
      <PageTopBar title="Shift detail" backHref="/shifts" />

      <Card>
        <div className={styles.dayLabel}>{shift.dayLabel}</div>
        <div className={styles.shiftTitle}>{shift.positionName}</div>
        <div className={styles.dayLabel}>
          {shift.timeRange} · {formatDurationHrs(shift.durationHours)}
        </div>
        <div style={{ marginTop: 10 }}>
          {shift.isOpen ? (
            <Badge tone="info">Open</Badge>
          ) : (
            <Badge tone="success">Confirmed</Badge>
          )}
        </div>
      </Card>

      <Card>
        <div className={styles.cardStack}>
          <div className={styles.iconRow}>
            <Icon name="map-pin" size={16} />
            <span>
              {shift.location.name}
              {shift.location.address ? ` · ${shift.location.address}` : ""}
            </span>
          </div>
          {shift.shiftMates.length === 0 ? (
            <div className={styles.iconRow}>
              <Icon name="users" size={16} />
              <span className={styles.muted}>No one else is scheduled that day.</span>
            </div>
          ) : (
            shift.shiftMates.map((m) => (
              <div key={m.shiftId} className={styles.iconRow}>
                <Avatar name={m.name} size={28} />
                <span>{m.name}</span>
                <span className={styles.muted}>
                  · {m.positionName} · {m.timeRange}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>

      {shift.notes && (
        <Card>
          <div className={styles.muted} style={{ fontWeight: 600 }}>
            Note from your manager
          </div>
          <div style={{ marginTop: 4, fontSize: 14, color: "var(--text-primary)" }}>
            {shift.notes}
          </div>
        </Card>
      )}

      {SWAPS_ENABLED && !shift.isOpen && new Date(shift.startsAt) > new Date() && (
        <RequestSwapButton shiftId={shift.id} />
      )}

      {!shift.isOpen && new Date(shift.startsAt) > new Date() && (
        <DropRequestButton
          shiftId={shift.id}
          shiftLabel={`${shift.dayLabel} ${shift.positionName.toLowerCase()} shift`}
          hasPendingDrop={shift.hasPendingDrop}
        />
      )}
    </div>
  );
}
