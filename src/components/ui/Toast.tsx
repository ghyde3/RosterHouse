import { Icon, type IconName } from "./Icon";
import { cx } from "./cx";
import styles from "./Toast.module.css";

export type ToastTone = "success" | "warning" | "danger" | "info";

/** Export defect fixed: the icon now varies by tone (was always a check). */
const TONE_ICON: Record<ToastTone, IconName> = {
  success: "check",
  warning: "alert-triangle",
  danger: "x",
  info: "bell",
};

export type ToastProps = {
  tone?: ToastTone;
  title: string;
  description?: string;
  onClose?: () => void;
} & Omit<React.ComponentPropsWithRef<"div">, "title">;

export function Toast({
  tone = "success",
  title,
  description,
  onClose,
  className,
  ...rest
}: ToastProps) {
  return (
    <div
      role="status"
      data-tone={tone}
      className={cx(styles.toast, className)}
      {...rest}
    >
      <span className={styles.iconWrap} aria-hidden="true">
        <Icon name={TONE_ICON[tone]} size={15} strokeWidth={2.5} />
      </span>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        {description && <div className={styles.description}>{description}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          className={styles.close}
          aria-label="Dismiss"
          onClick={onClose}
        >
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}
