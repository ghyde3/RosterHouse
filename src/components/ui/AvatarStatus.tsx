import { cx } from "./cx";
import { initialsOf } from "./initials";
import styles from "./AvatarStatus.module.css";

export type AvatarStatusValue = "available" | "unavailable" | "pending" | "off";

const STATUS_LABEL: Record<AvatarStatusValue, string> = {
  available: "Available",
  unavailable: "Unavailable",
  pending: "Pending",
  off: "Off",
};

export type AvatarStatusProps = {
  name: string;
  status?: AvatarStatusValue;
  size?: number;
} & React.ComponentPropsWithRef<"span">;

export function AvatarStatus({
  name,
  status = "available",
  size = 40,
  className,
  ...rest
}: AvatarStatusProps) {
  return (
    <span className={cx(styles.root, className)} {...rest}>
      <span
        className={styles.circle}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
        aria-hidden="true"
      >
        {initialsOf(name)}
      </span>
      <span
        data-status={status}
        className={styles.dot}
        style={{
          width: Math.round(size * 0.28),
          height: Math.round(size * 0.28),
        }}
      />
      <span className="sr-only">{STATUS_LABEL[status]}</span>
    </span>
  );
}
