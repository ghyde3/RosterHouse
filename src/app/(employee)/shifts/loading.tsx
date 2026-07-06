// src/app/(employee)/shifts/loading.tsx
import styles from "@/components/employee/employee.module.css";

export default function HomeLoading() {
  return (
    <div className={styles.screen} aria-busy="true" aria-label="Loading your shifts">
      <div className={styles.skeleton} style={{ height: 34, width: 140, marginTop: 18 }} />
      <div className={styles.skeleton} style={{ height: 88 }} />
      <div className={styles.skeleton} style={{ height: 20, width: 160, marginTop: 6 }} />
      <div className={styles.skeleton} style={{ height: 84 }} />
      <div className={styles.skeleton} style={{ height: 84 }} />
      <div className={styles.skeleton} style={{ height: 84 }} />
    </div>
  );
}
