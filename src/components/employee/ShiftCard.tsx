// src/components/employee/ShiftCard.tsx — linked shift row styled like the
// design's HomeScreen cards (day, position, time + status badge).
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import styles from "./employee.module.css";

type ShiftCardProps = {
  href: string;
  dayLabel: string;
  positionName: string;
  timeRange: string;
  badgeTone?: "success" | "info" | "neutral";
  badgeLabel?: string;
};

export function ShiftCard({
  href,
  dayLabel,
  positionName,
  timeRange,
  badgeTone,
  badgeLabel,
}: ShiftCardProps) {
  return (
    <Link href={href} className={styles.linkReset}>
      <Card hoverable>
        <div className={styles.cardRow}>
          <div>
            <div className={styles.dayLabel}>{dayLabel}</div>
            <div className={styles.shiftTitle}>{positionName}</div>
            <div className={styles.dayLabel}>{timeRange}</div>
          </div>
          {badgeLabel ? <Badge tone={badgeTone ?? "neutral"}>{badgeLabel}</Badge> : null}
        </div>
      </Card>
    </Link>
  );
}
