import { Spinner } from "@/components/ui/Spinner";
import styles from "./dashboard.module.css";

export default function ManagerLoading() {
  return (
    <div className={styles.page} role="status" aria-label="Loading">
      <Spinner />
    </div>
  );
}
