import { z } from "zod";
import { handleApiError, jsonErr, jsonOk, parseJson } from "@/lib/api";
import { hashPassword } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { Prisma } from "@/generated/prisma/client";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  email: z.email("Enter a valid email address."),
  phone: z.string().trim().optional(),
  password: z.string().min(8, "Password needs at least 8 characters."),
  businessName: z.string().trim().min(1, "Enter your business name."),
  locationName: z.string().trim().min(1, "Enter a location name."),
  timezone: z
    .string()
    .refine((tz) => (Intl.supportedValuesOf("timeZone") as string[]).includes(tz), "Choose a timezone from the list."),
  positions: z.array(z.string().trim().min(1)).min(1, "Add at least one position."),
});

const DUPLICATE_ACCOUNT_MESSAGE = "An account with that email or phone already exists. Try logging in instead.";

export async function POST(req: Request) {
  try {
    const parsed = await parseJson(req, signupSchema);
    if (parsed.error) return parsed.error;
    const input = parsed.data;

    // Stored lowercase — User.email is globally unique and authenticateUser
    // lowercases on read, so writes must match or lookups silently miss.
    const email = input.email.toLowerCase();
    let phone: string | null = null;
    if (input.phone) {
      phone = normalizePhone(input.phone);
      if (!phone) {
        return jsonErr(
          "invalid_phone",
          "That phone number doesn't look right. Use 10 digits, like (555) 123-4567.",
          400,
        );
      }
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] },
    });
    if (existing) {
      return jsonErr("account_exists", DUPLICATE_ACCOUNT_MESSAGE, 409);
    }

    const positionNames = [...new Set(input.positions.map((p) => p.trim()).filter(Boolean))];
    const passwordHash = await hashPassword(input.password); // slow — keep it outside the transaction

    // Org + location + positions + manager user are created atomically: a
    // failure partway through (e.g. a duplicate-email race that slipped past
    // the pre-check above) must never leave an orphaned org/location behind.
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data: { name: input.businessName } });
      const location = await tx.location.create({
        data: { organizationId: organization.id, name: input.locationName, timezone: input.timezone },
      });
      await tx.position.createMany({
        data: positionNames.map((name, i) => ({ locationId: location.id, name, sortOrder: i })),
      });
      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          name: input.name,
          email,
          phone,
          passwordHash,
          role: "manager",
        },
      });
      return { organizationId: organization.id, locationId: location.id, userId: user.id };
    });

    return jsonOk(result, 201);
  } catch (err) {
    // Defense-in-depth: the pre-check above closes most duplicate-account
    // cases, but a concurrent signup with the same email/phone can still
    // race past it and hit the unique constraint inside the transaction.
    // Map that to the same calm 409 instead of leaking a raw Prisma error.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonErr("account_exists", DUPLICATE_ACCOUNT_MESSAGE, 409);
    }
    return handleApiError(err);
  }
}
