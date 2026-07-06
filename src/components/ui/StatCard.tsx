import { Card } from "./Card";
import styles from "./StatCard.module.css";

export type StatCardProps = {
  label: string;
  value: React.ReactNode;
  /** Optional CSS color token for the value, e.g. "var(--status-warning)". */
  tone?: string;
  className?: string;
};

export function StatCard({ label, value, tone, className }: StatCardProps) {
  return (
    <Card className={className}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value} style={tone ? { color: tone } : undefined}>
        {value}
      </div>
    </Card>
  );
}
