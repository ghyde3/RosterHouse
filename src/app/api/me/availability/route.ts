import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk, parseJson } from "@/lib/api";
import { getEmployeeContext, getMyAvailability } from "@/lib/queries/employee";
import { getMyAvailabilityExceptions } from "@/lib/queries/availability-exceptions";
import { todayISOIn } from "@/lib/time-format";

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const ruleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isAvailable: z.boolean(),
  startTime: z.string().regex(timeRe, "Times must look like 09:00.").nullable(),
  endTime: z.string().regex(timeRe, "Times must look like 09:00.").nullable(),
});

// Day-level business rules live in a top-level superRefine (rather than on
// ruleSchema itself) so the resulting issue path is [] instead of
// ["rules", <index>] — parseJson prefixes messages with the joined path, and
// these messages are shown to the user verbatim (e.g. in a toast).
const putSchema = z
  .object({ rules: z.array(ruleSchema).length(7, "Provide one rule for each day of the week.") })
  .superRefine((b, ctx) => {
    if (new Set(b.rules.map((r) => r.dayOfWeek)).size !== 7) {
      ctx.addIssue({ code: "custom", message: "Provide one rule for each day of the week.", path: [] });
      return;
    }
    for (const r of b.rules) {
      if ((r.startTime === null) !== (r.endTime === null)) {
        ctx.addIssue({
          code: "custom",
          message: "Provide both start and end times, or neither.",
          path: [],
        });
        return;
      }
      if (r.startTime !== null && r.endTime !== null && r.startTime >= r.endTime) {
        ctx.addIssue({ code: "custom", message: "End time must be after start time.", path: [] });
        return;
      }
    }
  });

export async function GET() {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);
  const ctx = await getEmployeeContext(session.user.id);
  if (!ctx) return jsonErr("no_profile", "No employee profile is linked to this account.", 403);
  const [rules, exceptions] = await Promise.all([
    getMyAvailability(ctx.profileId),
    getMyAvailabilityExceptions(ctx.profileId, todayISOIn(ctx.timezone)),
  ]);
  return jsonOk({ rules, exceptions });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) return jsonErr("unauthorized", "You need to sign in.", 401);

  const parsed = await parseJson(request, putSchema);
  if (parsed.error) return parsed.error;

  const ctx = await getEmployeeContext(session.user.id);
  if (!ctx) return jsonErr("no_profile", "No employee profile is linked to this account.", 403);

  await prisma.$transaction([
    prisma.availabilityRule.deleteMany({ where: { employeeProfileId: ctx.profileId } }),
    prisma.availabilityRule.createMany({
      data: parsed.data.rules.map((r) => ({ ...r, employeeProfileId: ctx.profileId })),
    }),
  ]);

  return jsonOk({ rules: parsed.data.rules });
}
