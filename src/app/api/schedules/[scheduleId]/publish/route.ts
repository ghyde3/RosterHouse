import { handleApiError, jsonErr, jsonOk } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireManagerForApi } from "@/lib/manager-guard";
import { notifyUsers } from "@/lib/notify";
import { formatDateShort, toISODate } from "@/lib/time";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);
    const { scheduleId } = await params;
    const schedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, locationId: guard.location.id },
    });
    if (!schedule) return jsonErr("not_found", "That schedule no longer exists", 404);

    // Transaction flips THIS schedule and its draft shifts only — never other
    // weeks. publishedAt is set AFTER the shift updates so freshly published
    // shifts don't read as "edited after publish".
    const { employeeUserIds, shiftCount } = await prisma.$transaction(async (tx) => {
      await tx.shift.updateMany({
        where: { scheduleId, status: "draft" },
        data: { status: "published" },
      });
      await tx.schedule.update({
        where: { id: scheduleId },
        data: {
          status: "published",
          publishedAt: new Date(),
          publishedByUserId: guard.userId,
        },
      });
      const assigned = await tx.shift.findMany({
        where: { scheduleId, employeeProfileId: { not: null } },
        select: { employeeProfile: { select: { userId: true } } },
      });
      const count = await tx.shift.count({ where: { scheduleId } });
      return {
        employeeUserIds: [...new Set(assigned.map((s) => s.employeeProfile!.userId))],
        shiftCount: count,
      };
    });

    const session = await auth();
    await logAudit({
      organizationId: guard.location.organizationId,
      locationId: guard.location.id,
      actorUserId: guard.userId,
      actorName: session?.user?.name ?? "Manager",
      action: "schedule.published",
      entityType: "Schedule",
      entityId: scheduleId,
      detail: { weekStartDate: toISODate(schedule.weekStartDate), shiftCount },
    });

    const weekLabel = formatDateShort(toISODate(schedule.weekStartDate));
    const { count } = await notifyUsers(
      employeeUserIds.map((userId) => ({
        userId,
        type: "schedule_published" as const,
        title: "New schedule published",
        body: `Your schedule for the week of ${weekLabel} is ready.`,
      })),
    );
    return jsonOk({ count });
  } catch (err) {
    return handleApiError(err);
  }
}
