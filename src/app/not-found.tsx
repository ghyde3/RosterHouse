// Branded 404 for unknown URLs anywhere in the app (manager side included).
// The (employee) group adds its own not-found in Task 4.
// "Go to home" deliberately links to "/" — the public marketing landing page —
// which is correct for guests; signed-in users hitting "/" are redirected by role.
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default function RootNotFound() {
  return (
    <div className={styles.errorWrap}>
      <EmptyState
        title="This page doesn't exist"
        description="Check the address, or head back to your home screen."
        action={
          <Link href="/" className={styles.linkBrand}>
            Go to home
          </Link>
        }
      />
    </div>
  );
}
