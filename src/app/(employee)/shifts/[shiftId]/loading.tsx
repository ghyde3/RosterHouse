import styles from "@/components/employee/employee.module.css";

export default function ShiftDetailLoading() {
  return (
    <div className={styles.screen} aria-busy="true" aria-label="Loading shift">
      <div className={styles.skeleton} style={{ height: 34, width: 140, marginTop: 18 }} />
      <div className={styles.skeleton} style={{ height: 110 }} />
      <div className={styles.skeleton} style={{ height: 90 }} />
      <div className={styles.skeleton} style={{ height: 70 }} />
    </div>
  );
}
