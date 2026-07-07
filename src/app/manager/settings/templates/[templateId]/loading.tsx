import { Spinner } from "@/components/ui/Spinner";
import styles from "@/components/schedule/schedule.module.css";

export default function TemplateEditorLoading() {
  return (
    <div className={styles.loadingWrap} role="status" aria-label="Loading template">
      <Spinner />
      <span>Loading template…</span>
    </div>
  );
}
