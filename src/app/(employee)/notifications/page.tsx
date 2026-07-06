import { PageTopBar } from "@/components/employee/PageTopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default function NotificationsPage() {
  return (
    <div className={styles.screen}>
      <PageTopBar title="Notifications" backHref="/shifts" showBell={false} />
      <EmptyState title="Notifications are coming soon" description="This screen is being built." />
    </div>
  );
}
