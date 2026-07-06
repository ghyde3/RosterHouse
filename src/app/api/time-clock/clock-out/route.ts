import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getEmployeeProfile } from "@/lib/authz";
import { isWithinGeofence } from "@/lib/geo";
import { getTimeClockState } from "@/lib/timeclock";

const coordsSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = coordsSchema.safeParse(body);
  if (!parsed.success) return jsonErr("invalid_input", "Location coordinates look invalid.", 400);

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);

  let profile;
  try {
    profile = await getEmployeeProfile(user.id);
  } catch {
    return jsonErr("no_profile", "We couldn't find an employee profile for your account.", 403);
  }

  const active = await prisma.timeClockEntry.findFirst({
    where: { employeeProfileId: profile.id, clockOutAt: null },
    orderBy: { clockInAt: "desc" },
  });
  if (!active) return jsonErr("not_clocked_in", "You're not clocked in right now.", 409);

  const { lat, lng } = parsed.data;
  const loc = profile.location;
  const locationVerified =
    lat == null || lng == null || loc.latitude == null || loc.longitude == null
      ? null
      : isWithinGeofence({ lat, lng }, { lat: Number(loc.latitude), lng: Number(loc.longitude) }, loc.geofenceRadiusM ?? 150);

  await prisma.timeClockEntry.update({
    where: { id: active.id },
    data: { clockOutAt: new Date(), clockOutLat: lat ?? null, clockOutLng: lng ?? null },
  });

  const state = await getTimeClockState(profile.id);
  return jsonOk({ hoursToday: state.hoursToday, locationVerified });
}
