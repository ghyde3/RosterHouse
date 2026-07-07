// PUT upserts one exception per (profile, date); DELETE removes one by date.
// The profile always comes from the session — an employee can only edit
// their own exceptions. Body-carrying DELETE mirrors /api/me/push-devices.
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk, parseJson } from "@/lib/api";
import { getEmployeeContext } from "@/lib/queries/employee";

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must look like 2026-07-15.")
  .refine((d) => {
    const parsed = new Date(`${d}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === d;
  }, "That isn't a real calendar date.");

// Same shape rules as the weekly editor: both times or neither, start < end.
// Business rules live in a top-level superRefine so parseJson shows the
// message without a field-path prefix (these surface in the UI verbatim).
const putSchema = z
  .object({
    date: dateSchema,
    isAvailable: z.boolean(),
    startTime: z.string().regex(timeRe, "Times must look like 09:00.").nullable().optional(),
    endTime: z.string().regex(timeRe, "Times must look like 09:00.").nullable().optional(),
    note: z.string().trim().max(200, "Keep notes under 200 characters.").optional(),
  })
  .superRefine((b, ctx) => {
    const start = b.startTime ?? null;
    const end = b.endTime ?? null;
    if ((start === null) !== (end === null)) {
      ctx.addIssue({
        code: "custom",
        message: "Provide both start and end times, or neither.",
        path: [],
      });
      return;
    }
    if (start !== null && end !== null && start >= end) {
      ctx.addIssue({ code: "custom", message: "End time must be after start time.", path: [] });
    }
  });

const deleteSchema = z.object({ date: dateSchema });

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  const parsed = await parseJson(request, putSchema);
  if (parsed.error) return parsed.error;

  const ctx = await getEmployeeContext(session.user.id);
  if (!ctx) return jsonErr("no_profile", "No employee profile is linked to this account.", 403);

  const { date, isAvailable } = parsed.data;
  // Times only make sense on an available day; store an unavailable day as NULL/NULL.
  const values = {
    isAvailable,
    startTime: isAvailable ? (parsed.data.startTime ?? null) : null,
    endTime: isAvailable ? (parsed.data.endTime ?? null) : null,
    note: parsed.data.note ? parsed.data.note : null,
  };
  const stored = await prisma.availabilityException.upsert({
    where: {
      employeeProfileId_date: {
        employeeProfileId: ctx.profileId,
        date: new Date(`${date}T00:00:00.000Z`),
      },
    },
    create: {
      employeeProfileId: ctx.profileId,
      date: new Date(`${date}T00:00:00.000Z`),
      ...values,
    },
    update: values,
  });

  return jsonOk({
    exception: {
      date,
      isAvailable: stored.isAvailable,
      startTime: stored.startTime,
      endTime: stored.endTime,
      note: stored.note,
    },
  });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  const parsed = await parseJson(request, deleteSchema);
  if (parsed.error) return parsed.error;

  const ctx = await getEmployeeContext(session.user.id);
  if (!ctx) return jsonErr("no_profile", "No employee profile is linked to this account.", 403);

  const res = await prisma.availabilityException.deleteMany({
    where: {
      employeeProfileId: ctx.profileId,
      date: new Date(`${parsed.data.date}T00:00:00.000Z`),
    },
  });

  return jsonOk({ removed: res.count > 0 });
}
