import { cookies } from "next/headers";
import { z } from "zod";
import { handleApiError, jsonErr, jsonOk, parseJson } from "@/lib/api";
import { ACTIVE_LOCATION_COOKIE } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { requireManagerForApi } from "@/lib/manager-guard";

const ACTIVE_LOCATION_MAX_AGE_S = 60 * 60 * 24 * 365;

const schema = z.object({
  locationId: z.string().min(1, { message: "Choose a location" }),
});

/** Point the manager's session at another of their org's locations. */
export async function PUT(req: Request) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);

    const parsed = await parseJson(req, schema);
    if (parsed.error) return parsed.error;

    const location = await prisma.location.findFirst({
      where: { id: parsed.data.locationId, organizationId: guard.location.organizationId },
      select: { id: true, name: true },
    });
    if (!location) {
      return jsonErr("location_not_found", "That location isn't part of your business.", 404);
    }

    (await cookies()).set(ACTIVE_LOCATION_COOKIE, location.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: ACTIVE_LOCATION_MAX_AGE_S,
    });

    return jsonOk({ locationId: location.id, name: location.name });
  } catch (err) {
    return handleApiError(err);
  }
}
