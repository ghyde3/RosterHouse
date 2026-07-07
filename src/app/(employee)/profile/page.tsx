import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEmployeeContext } from "@/lib/queries/employee";
import { PageTopBar } from "@/components/employee/PageTopBar";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { NotificationPrefs } from "./NotificationPrefs";
import { PushDeviceSetup } from "@/components/employee/PushDeviceSetup";
import { CalendarFeed } from "@/components/employee/CalendarFeed";
import { logOut } from "./actions";
import styles from "@/components/employee/employee.module.css";

export default async function ProfilePage() {
  const user = await requireUser();
  const ctx = await getEmployeeContext(user.id);
  if (!ctx) throw new Error("No employee profile is linked to this account.");
  const profile = await prisma.employeeProfile.findUnique({
    where: { id: ctx.profileId },
    select: { calendarToken: true },
  });

  return (
    <div className={styles.screen}>
      <PageTopBar title="Profile" />

      <Card>
        <div className={styles.profileRow}>
          <Avatar name={ctx.name} size={52} />
          <div>
            <div className={styles.shiftTitle}>{ctx.name}</div>
            <div className={styles.muted}>
              {[ctx.primaryPositionName, ctx.locationName].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
      </Card>

      <h2 className={styles.sectionTitle}>Notification preferences</h2>
      <NotificationPrefs
        initial={{
          notifyPush: ctx.notifyPush,
          notifySms: ctx.notifySms,
          notifyEmail: ctx.notifyEmail,
        }}
      />
      <PushDeviceSetup />

      <h2 className={styles.sectionTitle}>Calendar</h2>
      <CalendarFeed initialToken={profile?.calendarToken ?? null} />

      <form action={logOut}>
        <Button variant="ghost" fullWidth type="submit">
          Log out
        </Button>
      </form>
    </div>
  );
}
