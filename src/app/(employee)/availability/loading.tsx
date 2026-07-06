import styles from "@/components/employee/employee.module.css";

export default function AvailabilityLoading() {
  return (
    <div className={styles.screen} aria-busy="true" aria-label="Loading availability">
      <div className={styles.skeleton} style={{ height: 34, width: 160, marginTop: 18 }} />
      <div className={styles.skeleton} style={{ height: 18, width: 260 }} />
      <div className={styles.skeleton} style={{ height: 36 }} />
      <div className={styles.skeleton} style={{ height: 320 }} />
    </div>
  );
}
