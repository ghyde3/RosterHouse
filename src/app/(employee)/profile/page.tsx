import { PageTopBar } from "@/components/employee/PageTopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default function ProfilePage() {
  return (
    <div className={styles.screen}>
      <PageTopBar title="Profile" />
      <EmptyState title="Your profile is coming soon" description="This screen is being built." />
    </div>
  );
}
