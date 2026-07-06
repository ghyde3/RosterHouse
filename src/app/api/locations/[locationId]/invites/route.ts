import { randomUUID } from "crypto";
import { z } from "zod";
import { handleApiError, jsonErr, jsonOk, parseJson } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { assertLocationMember } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

const inviteSchema = z.object({
  name: z.string().trim().min(1, "Enter the employee's name."),
  contact: z.string().trim().min(1, "Enter a phone number or email."),
  positionId: z.string().min(1, "Choose a position."),
});

export async function POST(req: Request, { params }: { params: Promise<{ locationId: string }> }) {
  try {
    const { locationId } = await params;
    const user = await apiUser();
    if (!user) return jsonErr("unauthorized", "You need to log in to do that.", 401);
    if (user.role !== "manager") return jsonErr("forbidden", "Only managers can invite employees.", 403);
    await assertLocationMember(user.id, locationId);

    const parsed = await parseJson(req, inviteSchema);
    if (parsed.error) return parsed.error;
    const { name, contact, positionId } = parsed.data;

    let email: string | null = null;
    let phone: string | null = null;
    if (contact.includes("@")) {
      email = contact.toLowerCase();
    } else {
      phone = normalizePhone(contact);
      if (!phone) {
        return jsonErr("invalid_contact", "That doesn't look like a phone number or an email address.", 400);
      }
    }

    const position = await prisma.position.findFirst({ where: { id: positionId, locationId } });
    if (!position) return jsonErr("position_not_found", "That position doesn't exist at this location.", 404);

    const location = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
    const invite = await prisma.invite.create({
      data: {
        organizationId: location.organizationId,
        locationId,
        invitedByUserId: user.id,
        positionId,
        name,
        email,
        phone,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    // v1 delivery: the manager copies this link into a text or email.
    // SMS delivery lands with the Phase 5 notifier.
    const inviteUrl = `${new URL(req.url).origin}/invite/${invite.token}`;
    return jsonOk({ inviteId: invite.id, token: invite.token, inviteUrl }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
