import { requireUser } from "@/lib/auth";
import { getEmployeeProfile } from "@/lib/authz";
import { getTimeClockState } from "@/lib/timeclock";
import { TimeClock } from "@/components/employee/TimeClock";

export default async function ClockPage() {
  const user = await requireUser();
  const profile = await getEmployeeProfile(user.id);
  const state = await getTimeClockState(profile.id);
  return <TimeClock initial={state} />;
}
