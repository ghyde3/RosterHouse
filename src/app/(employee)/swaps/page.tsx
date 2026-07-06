import { PageTopBar } from "@/components/employee/PageTopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default function SwapsPage() {
  return (
    <div className={styles.screen}>
      <PageTopBar title="Open shifts" />
      <EmptyState
        title="Open shifts and swaps are coming soon"
        description="You'll claim open shifts and request swaps here."
      />
    </div>
  );
}
