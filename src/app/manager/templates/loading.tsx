import { Spinner } from "@/components/ui/Spinner";
import styles from "@/components/schedule/schedule.module.css";

export default function TemplatesLoading() {
  return (
    <div className={styles.loadingWrap} role="status" aria-label="Loading templates">
      <Spinner />
      <span>Loading templates…</span>
    </div>
  );
}
