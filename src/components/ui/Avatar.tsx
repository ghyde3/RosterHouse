import { cx } from "./cx";
import { initialsOf } from "./initials";
import styles from "./Avatar.module.css";

export type AvatarProps = {
  name: string;
  size?: number;
} & React.ComponentPropsWithRef<"span">;

export function Avatar({
  name,
  size = 40,
  className,
  style,
  ...rest
}: AvatarProps) {
  return (
    <span
      className={cx(styles.avatar, className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        ...style,
      }}
      {...rest}
    >
      {initialsOf(name)}
    </span>
  );
}
