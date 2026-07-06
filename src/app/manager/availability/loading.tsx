import styles from "./availability.module.css";

export default function ManagerAvailabilityLoading() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading team availability">
      <div className={styles.skeleton} style={{ height: 34, width: 240 }} />
      <div className={styles.skeleton} style={{ height: 420 }} />
    </div>
  );
}
