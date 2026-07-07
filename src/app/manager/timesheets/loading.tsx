import { Spinner } from "@/components/ui/Spinner";
import styles from "@/components/schedule/schedule.module.css";

export default function TimesheetsLoading() {
  return (
    <div className={styles.loadingWrap} role="status" aria-label="Loading timesheets">
      <Spinner />
      <span>Loading timesheets…</span>
    </div>
  );
}
