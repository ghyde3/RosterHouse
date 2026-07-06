import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonErr, jsonOk } from "@/lib/api";
import { sessionUser } from "@/lib/api-session";
import { getEmployeeProfile } from "@/lib/authz";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const createTimeOffSchema = z
  .object({
    startDate: z.string().regex(ISO_DATE, { message: "Start date must be a date like 2026-07-14." }),
    endDate: z.string().regex(ISO_DATE, { message: "End date must be a date like 2026-07-16." }),
    reason: z.enum(["vacation", "sick", "personal", "other"]),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.endDate < val.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after the start date." });
    }
    if (val.reason === "other" && !val.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Tell your manager why you need this time off." });
    }
  });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createTimeOffSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("invalid_input", parsed.error.issues[0]?.message ?? "Check the request details and try again.", 400);
  }

  const user = await sessionUser();
  if (!user) return jsonErr("unauthorized", "You need to sign in to do that.", 401);

  let profileId: string;
  try {
    profileId = (await getEmployeeProfile(user.id)).id;
  } catch {
    return jsonErr("no_profile", "We couldn't find an employee profile for your account.", 403);
  }

  const created = await prisma.timeOffRequest.create({
    data: {
      employeeProfileId: profileId,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      reason: parsed.data.reason,
      note: parsed.data.note || null,
    },
  });
  return jsonOk({ id: created.id, status: created.status });
}
