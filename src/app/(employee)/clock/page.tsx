import { PageTopBar } from "@/components/employee/PageTopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default function ClockPage() {
  return (
    <div className={styles.screen}>
      <PageTopBar title="Time clock" />
      <EmptyState
        title="The time clock is coming soon"
        description="You'll clock in and out of your shifts here."
      />
    </div>
  );
}
