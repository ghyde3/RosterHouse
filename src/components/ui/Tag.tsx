import { Icon } from "./Icon";
import { cx } from "./cx";
import styles from "./Tag.module.css";

export type TagProps = {
  /** Renders a real remove button when provided (client components only). */
  onRemove?: () => void;
  color?: "neutral" | "brand" | "accent";
} & React.ComponentPropsWithRef<"span">;

export function Tag({
  onRemove,
  color = "neutral",
  className,
  children,
  ...rest
}: TagProps) {
  return (
    <span data-color={color} className={cx(styles.tag, className)} {...rest}>
      {children}
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          aria-label="Remove"
          onClick={onRemove}
        >
          <Icon name="x" size={12} />
        </button>
      )}
    </span>
  );
}
