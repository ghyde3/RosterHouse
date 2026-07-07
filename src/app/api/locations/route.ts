import { cookies } from "next/headers";
import { handleApiError, jsonErr, jsonOk, parseJson } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { ACTIVE_LOCATION_COOKIE } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { requireManagerForApi } from "@/lib/manager-guard";
import { createLocationSchema } from "@/lib/location-schemas";

const ACTIVE_LOCATION_MAX_AGE_S = 60 * 60 * 24 * 365;

export async function POST(req: Request) {
  try {
    const guard = await requireManagerForApi();
    if (!guard.ok) return jsonErr(guard.code, guard.message, guard.status);

    const parsed = await parseJson(req, createLocationSchema);
    if (parsed.error) return parsed.error;
    const input = parsed.data;

    const location = await prisma.location.create({
      data: {
        organizationId: guard.location.organizationId,
        name: input.name,
        timezone: input.timezone,
        address: input.address ?? null,
      },
      select: { id: true, name: true, timezone: true, address: true },
    });

    // Managers create a location to set it up next — switch them to it.
    (await cookies()).set(ACTIVE_LOCATION_COOKIE, location.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: ACTIVE_LOCATION_MAX_AGE_S,
    });

    const session = await auth();
    await logAudit({
      organizationId: guard.location.organizationId,
      locationId: location.id,
      actorUserId: guard.userId,
      actorName: session?.user?.name ?? "Manager",
      action: "location.created",
      entityType: "Location",
      entityId: location.id,
      detail: { name: location.name, timezone: location.timezone },
    });

    return jsonOk({ location }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
