import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEmployeeProfile } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { SWAPS_ENABLED } from "@/lib/flags";
import { isoDateOf, listQualifiedCoworkers } from "@/lib/requests";
import { formatMediumDate, formatShiftRange } from "@/lib/time";
import { SwapComposer } from "@/components/employee/SwapComposer";

export default async function SwapComposerPage({ params }: { params: Promise<{ shiftId: string }> }) {
  if (!SWAPS_ENABLED) redirect("/shifts");
  const { shiftId } = await params;
  const user = await requireUser();
  const profile = await getEmployeeProfile(user.id);

  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { position: true, location: true },
  });
  if (!shift || shift.employeeProfileId !== profile.id) notFound();
  if (shift.status !== "published" || shift.startsAt <= new Date()) redirect(`/shifts/${shiftId}`);

  const [coworkers, pendingRequest] = await Promise.all([
    listQualifiedCoworkers(shift.locationId, shift.positionId, profile.id),
    prisma.swapRequest.findFirst({ where: { shiftId, status: "pending" } }),
  ]);

  const shiftLabel = `${formatMediumDate(isoDateOf(shift.date))} · ${shift.position.name} · ${formatShiftRange(
    shift.startsAt,
    shift.endsAt,
    shift.location.timezone,
  )}`;

  return (
    <SwapComposer
      shiftId={shiftId}
      shiftLabel={shiftLabel}
      coworkers={coworkers}
      alreadyPending={pendingRequest !== null}
    />
  );
}
