import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getEmployeeProfile } from "@/lib/authz";
import { isWithinGeofence } from "@/lib/geo";
import { CLOCK_IN_EARLY_MS, pickClockInShift } from "@/lib/timeclock";

const coordsSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

function verifyLocation(
  lat: number | undefined,
  lng: number | undefined,
  location: { latitude: unknown; longitude: unknown; geofenceRadiusM: number | null },
): boolean | null {
  if (lat == null || lng == null || location.latitude == null || location.longitude == null) return null;
  return isWithinGeofence(
    { lat, lng },
    { lat: Number(location.latitude), lng: Number(location.longitude) },
    location.geofenceRadiusM ?? 150,
  );
}

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
  });
  if (active) return jsonErr("already_clocked_in", "You're already clocked in.", 409);

  const now = new Date();
  const candidates = await prisma.shift.findMany({
    where: {
      employeeProfileId: profile.id,
      locationId: profile.locationId,
      status: "published",
      startsAt: { lte: new Date(now.getTime() + CLOCK_IN_EARLY_MS) },
      endsAt: { gte: now },
    },
    include: { position: true },
  });
  const matched = pickClockInShift(candidates, now);

  const { lat, lng } = parsed.data;
  const locationVerified = verifyLocation(lat, lng, profile.location);

  const entry = await prisma.timeClockEntry.create({
    data: {
      employeeProfileId: profile.id,
      locationId: profile.locationId,
      shiftId: matched?.id ?? null,
      clockInAt: now,
      clockInLat: lat ?? null,
      clockInLng: lng ?? null,
    },
  });

  return jsonOk({
    entryId: entry.id,
    clockInAt: entry.clockInAt.toISOString(),
    positionName: matched?.position.name ?? null,
    locationVerified,
  });
}
