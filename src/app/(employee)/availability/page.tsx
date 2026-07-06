import { requireUser } from "@/lib/auth";
import { getEmployeeContext, getMyAvailability } from "@/lib/queries/employee";
import { listMyTimeOffRequests } from "@/lib/requests";
import { PageTopBar } from "@/components/employee/PageTopBar";
import { TimeOffSection } from "@/components/employee/TimeOffSection";
import { AvailabilityEditor } from "./AvailabilityEditor";
import styles from "@/components/employee/employee.module.css";

export default async function AvailabilityPage() {
  const user = await requireUser();
  const ctx = await getEmployeeContext(user.id);
  if (!ctx) throw new Error("No employee profile is linked to this account.");
  const rules = await getMyAvailability(ctx.profileId);
  const timeOffRequests = await listMyTimeOffRequests(ctx.profileId);

  return (
    <div className={styles.screen}>
      <PageTopBar title="Availability" />
      <AvailabilityEditor initialRules={rules} />
      <TimeOffSection requests={timeOffRequests} />
    </div>
  );
}
