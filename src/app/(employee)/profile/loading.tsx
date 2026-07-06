import styles from "@/components/employee/employee.module.css";

export default function ProfileLoading() {
  return (
    <div className={styles.screen} aria-busy="true" aria-label="Loading profile">
      <div className={styles.skeleton} style={{ height: 34, width: 120, marginTop: 18 }} />
      <div className={styles.skeleton} style={{ height: 84 }} />
      <div className={styles.skeleton} style={{ height: 20, width: 200, marginTop: 6 }} />
      <div className={styles.skeleton} style={{ height: 150 }} />
    </div>
  );
}
