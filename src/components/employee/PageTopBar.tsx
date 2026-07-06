import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EmployeeTopBar } from "@/components/chrome/EmployeeTopBar";
import { Icon } from "@/components/ui/Icon";
import styles from "./PageTopBar.module.css";

type PageTopBarProps = {
  title: string;
  backHref?: string;
  /** Hide the bell on the notifications screen itself. @default true */
  showBell?: boolean;
};

export async function PageTopBar({ title, backHref, showBell = true }: PageTopBarProps) {
  let unreadCount = 0;
  if (showBell) {
    const session = await auth();
    if (session?.user) {
      unreadCount = await prisma.notification.count({
        where: { userId: session.user.id, readAt: null },
      });
    }
  }
  const bell = showBell ? (
    <Link href="/notifications" aria-label="Notifications" className={styles.bell}>
      <Icon name="bell" size={20} />
      {unreadCount > 0 && (
        <span className={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
      )}
    </Link>
  ) : undefined;
  return <EmployeeTopBar title={title} backHref={backHref} action={bell} />;
}
