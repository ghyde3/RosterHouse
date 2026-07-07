// GET /api/calendar/[token] — public iCal feed; the unguessable token IS the auth.
import { prisma } from "@/lib/db";
import { handleApiError, jsonErr } from "@/lib/api";
import { buildCalendar } from "@/lib/ical";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const profile = await prisma.employeeProfile.findUnique({
      where: { calendarToken: token },
      select: { id: true },
    });
    if (!profile) {
      return jsonErr("calendar_not_found", "This calendar link is no longer valid.", 404);
    }

    // Published, assigned shifts from 14 days ago (service date) onward.
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    since.setUTCHours(0, 0, 0, 0);
    const shifts = await prisma.shift.findMany({
      where: {
        employeeProfileId: profile.id,
        status: "published",
        date: { gte: since },
      },
      include: { position: true, location: true },
      orderBy: { startsAt: "asc" },
    });

    const ics = buildCalendar(
      shifts.map((s) => ({
        id: s.id,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        positionName: s.position.name,
        locationName: s.location.name,
        notes: s.notes,
      })),
    );

    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="rosterhouse.ics"',
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
