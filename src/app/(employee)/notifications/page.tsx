import { requireUser } from "@/lib/auth";
import { getMyNotifications } from "@/lib/queries/employee";
import { PageTopBar } from "@/components/employee/PageTopBar";
import { NotificationsList } from "./NotificationsList";
import styles from "@/components/employee/employee.module.css";

export default async function NotificationsPage() {
  const user = await requireUser();
  const first = await getMyNotifications(user.id, { limit: 20 });

  return (
    <div className={styles.screen}>
      <PageTopBar title="Notifications" backHref="/shifts" showBell={false} />
      <NotificationsList initial={first} />
    </div>
  );
}
