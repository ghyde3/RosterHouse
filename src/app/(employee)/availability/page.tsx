import { requireUser } from "@/lib/auth";
import { getEmployeeContext, getMyAvailability } from "@/lib/queries/employee";
import { getMyAvailabilityExceptions } from "@/lib/queries/availability-exceptions";
import { listMyTimeOffRequests } from "@/lib/requests";
import { todayISOIn } from "@/lib/time-format";
import { PageTopBar } from "@/components/employee/PageTopBar";
import { TimeOffSection } from "@/components/employee/TimeOffSection";
import { AvailabilityEditor } from "./AvailabilityEditor";
import { ExceptionsSection } from "./ExceptionsSection";
import styles from "@/components/employee/employee.module.css";

export default async function AvailabilityPage() {
  const user = await requireUser();
  const ctx = await getEmployeeContext(user.id);
  if (!ctx) throw new Error("No employee profile is linked to this account.");
  const todayISO = todayISOIn(ctx.timezone);
  const rules = await getMyAvailability(ctx.profileId);
  const exceptions = await getMyAvailabilityExceptions(ctx.profileId, todayISO);
  const timeOffRequests = await listMyTimeOffRequests(ctx.profileId);

  return (
    <div className={styles.screen}>
      <PageTopBar title="Availability" />
      <AvailabilityEditor initialRules={rules} />
      <ExceptionsSection exceptions={exceptions} todayISO={todayISO} />
      <TimeOffSection
        requests={timeOffRequests}
        vacationBalanceHours={ctx.vacationBalanceHours}
        sickBalanceHours={ctx.sickBalanceHours}
      />
    </div>
  );
}
