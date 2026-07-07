import { SettingsSubnav } from "./SettingsSubnav";
import styles from "./settings.module.css";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Settings</h1>
        <div className={styles.subtitle}>Manage your location, positions, and schedule templates.</div>
      </div>
      <SettingsSubnav />
      <div>{children}</div>
    </div>
  );
}
