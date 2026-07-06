import { PageTopBar } from "@/components/employee/PageTopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default function AvailabilityPage() {
  return (
    <div className={styles.screen}>
      <PageTopBar title="Availability" />
      <EmptyState title="Availability editing is coming soon" description="This screen is being built." />
    </div>
  );
}
