// src/app/(employee)/not-found.tsx — employee-group 404, rendered inside the
// mobile shell (the root-level not-found from Task 1 covers everything else).
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "@/components/employee/employee.module.css";

export default function EmployeeNotFound() {
  return (
    <div className={styles.screen}>
      <EmptyState
        title="This page isn't available"
        description="It may have been removed, or you may not have access to it."
        action={
          <Link href="/shifts" className={styles.linkBrand}>
            Go to home
          </Link>
        }
      />
    </div>
  );
}
