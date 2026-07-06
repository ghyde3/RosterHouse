import styles from "@/components/employee/employee.module.css";

export default function NotificationsLoading() {
  return (
    <div className={styles.screen} aria-busy="true" aria-label="Loading notifications">
      <div className={styles.skeleton} style={{ height: 34, width: 180, marginTop: 18 }} />
      <div className={styles.skeleton} style={{ height: 72 }} />
      <div className={styles.skeleton} style={{ height: 72 }} />
      <div className={styles.skeleton} style={{ height: 72 }} />
    </div>
  );
}
