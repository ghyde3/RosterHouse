// prisma/seed.ts — fresh, coherent demo org ("Harbor & Vine").
// Re-runnable: deletes any existing "Harbor & Vine" org (cascades to every
// child row) and recreates everything. Run with: npm run db:seed
import "dotenv/config";
import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/authz";

const TZ = "America/New_York";
const ORG_NAME = "Harbor & Vine";
const PASSWORD = "rosterhouse1";

type EmployeeSpec = {
  name: string;
  email: string;
  phone: string;
  primary: string; // position name
  also: string[]; // extra qualified positions
  hourlyRate: string; // Decimal as string
  status?: "active" | "inactive";
};

const EMPLOYEES: EmployeeSpec[] = [
  { name: "Maria Garcia", email: "maria@harborvine.test", phone: "+15550100101", primary: "Line cook", also: ["Server"], hourlyRate: "19.50" },
  { name: "Sam Torres", email: "sam@harborvine.test", phone: "+15550100102", primary: "Line cook", also: [], hourlyRate: "18.00" },
  { name: "Alex Kim", email: "alex@harborvine.test", phone: "+15550100103", primary: "Server", also: ["Host"], hourlyRate: "12.50" },
  { name: "Priya Shah", email: "priya@harborvine.test", phone: "+15550100104", primary: "Server", also: [], hourlyRate: "12.50" },
  { name: "Jordan Park", email: "jordan@harborvine.test", phone: "+15550100105", primary: "Dishwasher", also: ["Line cook"], hourlyRate: "15.00" },
  { name: "Dana Lee", email: "dana@harborvine.test", phone: "+15550100106", primary: "Host", also: ["Server"], hourlyRate: "14.00" },
  { name: "Chris Nguyen", email: "chris@harborvine.test", phone: "+15550100107", primary: "Server", also: ["Dishwasher"], hourlyRate: "12.50" },
  { name: "Taylor Brooks", email: "taylor@harborvine.test", phone: "+15550100108", primary: "Line cook", also: [], hourlyRate: "18.50" },
  { name: "Morgan Reyes", email: "morgan@harborvine.test", phone: "+15550100109", primary: "Dishwasher", also: [], hourlyRate: "15.00", status: "inactive" },
  { name: "Jessie Chen", email: "jessie@harborvine.test", phone: "+15550100110", primary: "Host", also: [], hourlyRate: "14.00" },
];

// Weekly availability exceptions; any (employee, day) not listed = available
// all day. dayOfWeek: 0=Mon .. 6=Sun (matches AvailabilityRule and the UI).
const AVAILABILITY_EXCEPTIONS: Record<
  string,
  Record<number, { isAvailable: boolean; startTime?: string; endTime?: string }>
> = {
  "maria@harborvine.test": { 6: { isAvailable: false } }, // Sundays off
  "alex@harborvine.test": {
    0: { isAvailable: true, startTime: "09:00", endTime: "21:00" },
    1: { isAvailable: true, startTime: "09:00", endTime: "21:00" },
  },
  "dana@harborvine.test": { 5: { isAvailable: false }, 6: { isAvailable: false } }, // weekends off
  "sam@harborvine.test": { 3: { isAvailable: true, startTime: "07:00", endTime: "15:00" } },
};

type ShiftSpec = {
  day: number; // 0=Mon .. 6=Sun offset from the week's Monday
  start: [number, number]; // [hour, minute], location-local 24h
  end: [number, number]; // end <= start means the shift crosses midnight
  position: string;
  employee: string | null; // employee email, or null = open shift
  notes?: string;
};

const CURRENT_WEEK_SHIFTS: ShiftSpec[] = [
  { day: 0, start: [7, 0], end: [15, 0], position: "Line cook", employee: "maria@harborvine.test" },
  { day: 0, start: [11, 0], end: [19, 0], position: "Server", employee: "alex@harborvine.test" },
  { day: 0, start: [16, 0], end: [22, 0], position: "Dishwasher", employee: "jordan@harborvine.test" },
  { day: 1, start: [7, 0], end: [15, 0], position: "Line cook", employee: "sam@harborvine.test" },
  { day: 1, start: [11, 0], end: [19, 0], position: "Server", employee: "priya@harborvine.test" },
  { day: 1, start: [16, 0], end: [22, 0], position: "Dishwasher", employee: "chris@harborvine.test" },
  { day: 2, start: [7, 0], end: [15, 0], position: "Line cook", employee: "maria@harborvine.test" },
  { day: 2, start: [11, 0], end: [19, 0], position: "Server", employee: "alex@harborvine.test" },
  { day: 2, start: [10, 0], end: [16, 0], position: "Host", employee: "dana@harborvine.test" },
  { day: 3, start: [7, 0], end: [15, 0], position: "Line cook", employee: "sam@harborvine.test" },
  { day: 3, start: [10, 0], end: [16, 0], position: "Host", employee: "dana@harborvine.test" },
  { day: 3, start: [16, 0], end: [22, 0], position: "Server", employee: "chris@harborvine.test" },
  { day: 4, start: [14, 0], end: [20, 0], position: "Line cook", employee: "maria@harborvine.test", notes: "Inventory count at close." },
  { day: 4, start: [16, 0], end: [22, 0], position: "Server", employee: "priya@harborvine.test" },
  { day: 4, start: [18, 0], end: [0, 0], position: "Dishwasher", employee: "jordan@harborvine.test" }, // crosses midnight
  { day: 5, start: [10, 0], end: [18, 0], position: "Line cook", employee: "taylor@harborvine.test" },
  { day: 5, start: [16, 0], end: [22, 0], position: "Server", employee: "alex@harborvine.test" },
  { day: 5, start: [17, 0], end: [23, 0], position: "Dishwasher", employee: "chris@harborvine.test" },
  { day: 6, start: [9, 0], end: [17, 0], position: "Line cook", employee: "sam@harborvine.test" },
  { day: 6, start: [11, 0], end: [19, 0], position: "Server", employee: "priya@harborvine.test" },
];

const NEXT_WEEK_SHIFTS: ShiftSpec[] = [
  { day: 0, start: [7, 0], end: [15, 0], position: "Line cook", employee: "maria@harborvine.test" },
  { day: 0, start: [11, 0], end: [19, 0], position: "Server", employee: "alex@harborvine.test" },
  { day: 0, start: [16, 0], end: [22, 0], position: "Dishwasher", employee: "jordan@harborvine.test" },
  { day: 1, start: [7, 0], end: [15, 0], position: "Line cook", employee: "sam@harborvine.test" },
  { day: 1, start: [11, 0], end: [19, 0], position: "Server", employee: "priya@harborvine.test" },
  // Deliberate double-booking: Maria holds two overlapping Wednesday shifts.
  { day: 2, start: [7, 0], end: [15, 0], position: "Line cook", employee: "maria@harborvine.test" },
  { day: 2, start: [12, 0], end: [18, 0], position: "Server", employee: "maria@harborvine.test" },
  { day: 3, start: [7, 0], end: [15, 0], position: "Line cook", employee: "taylor@harborvine.test" },
  { day: 3, start: [10, 0], end: [16, 0], position: "Host", employee: "dana@harborvine.test" },
  { day: 4, start: [16, 0], end: [22, 0], position: "Server", employee: "chris@harborvine.test" },
  { day: 4, start: [18, 0], end: [0, 0], position: "Dishwasher", employee: "jordan@harborvine.test" },
  // Open (unassigned) shift — Saturday evening server.
  { day: 5, start: [16, 0], end: [22, 0], position: "Server", employee: null },
  { day: 6, start: [11, 0], end: [19, 0], position: "Server", employee: "priya@harborvine.test" },
];

/** Monday 00:00 of the current week in the location's timezone. */
function mondayOfCurrentWeek(): TZDate {
  const now = TZDate.tz(TZ);
  const sinceMonday = (now.getDay() + 6) % 7; // getDay(): 0=Sun .. 6=Sat
  const monday = addDays(now, -sinceMonday);
  return new TZDate(monday.getFullYear(), monday.getMonth(), monday.getDate(), TZ);
}

/** UTC-midnight Date for a local calendar day — what Prisma @db.Date expects. */
function dateOnly(d: TZDate): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function shiftInstants(weekMonday: TZDate, spec: ShiftSpec) {
  const day = addDays(weekMonday, spec.day);
  const startsAt = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), spec.start[0], spec.start[1], TZ);
  let endsAt = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), spec.end[0], spec.end[1], TZ);
  if (endsAt.getTime() <= startsAt.getTime()) {
    endsAt = addDays(endsAt, 1); // end-before-start = crosses midnight
  }
  return { date: dateOnly(day), startsAt: new Date(startsAt.getTime()), endsAt: new Date(endsAt.getTime()) };
}

async function main() {
  console.log(`Seeding "${ORG_NAME}" demo data...`);
  await prisma.organization.deleteMany({ where: { name: ORG_NAME } }); // cascade wipes the old demo

  const org = await prisma.organization.create({ data: { name: ORG_NAME } });
  const location = await prisma.location.create({
    data: {
      organizationId: org.id,
      name: "Downtown",
      timezone: TZ,
      address: "214 Harbor St",
      overtimeHoursPerWeek: 40,
    },
  });

  const positionNames = ["Line cook", "Server", "Dishwasher", "Host"];
  const positions: Record<string, string> = {};
  for (const [i, name] of positionNames.entries()) {
    const position = await prisma.position.create({
      data: { locationId: location.id, name, sortOrder: i },
    });
    positions[name] = position.id;
  }

  const passwordHash = await hashPassword(PASSWORD);

  const manager = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: "Jamie Park",
      email: "jamie@harborvine.test",
      phone: "+15550100100",
      passwordHash,
      role: "manager",
    },
  });

  const profileIdByEmail: Record<string, string> = {};
  for (const spec of EMPLOYEES) {
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        name: spec.name,
        email: spec.email,
        phone: spec.phone,
        passwordHash,
        role: "employee",
      },
    });
    const profile = await prisma.employeeProfile.create({
      data: {
        userId: user.id,
        locationId: location.id,
        primaryPositionId: positions[spec.primary],
        hourlyRate: spec.hourlyRate,
        status: spec.status ?? "active",
      },
    });
    profileIdByEmail[spec.email] = profile.id;

    const qualified = [spec.primary, ...spec.also];
    await prisma.employeePosition.createMany({
      data: qualified.map((positionName) => ({
        employeeProfileId: profile.id,
        positionId: positions[positionName],
      })),
    });

    const exceptions = AVAILABILITY_EXCEPTIONS[spec.email] ?? {};
    await prisma.availabilityRule.createMany({
      data: Array.from({ length: 7 }, (_, dayOfWeek) => {
        const ex = exceptions[dayOfWeek];
        return {
          employeeProfileId: profile.id,
          dayOfWeek,
          isAvailable: ex ? ex.isAvailable : true,
          startTime: ex?.startTime ?? null,
          endTime: ex?.endTime ?? null,
        };
      }),
    });
  }

  const currentMonday = mondayOfCurrentWeek();
  const nextMonday = addDays(currentMonday, 7);

  const currentSchedule = await prisma.schedule.create({
    data: {
      locationId: location.id,
      weekStartDate: dateOnly(currentMonday),
      status: "published",
    },
  });
  const nextSchedule = await prisma.schedule.create({
    data: { locationId: location.id, weekStartDate: dateOnly(nextMonday), status: "draft" },
  });

  async function createShifts(
    scheduleId: string,
    weekMonday: TZDate,
    specs: ShiftSpec[],
    status: "draft" | "published",
  ) {
    for (const spec of specs) {
      const { date, startsAt, endsAt } = shiftInstants(weekMonday, spec);
      await prisma.shift.create({
        data: {
          scheduleId,
          locationId: location.id,
          positionId: positions[spec.position],
          employeeProfileId: spec.employee ? profileIdByEmail[spec.employee] : null,
          date,
          startsAt,
          endsAt,
          status,
          notes: spec.notes ?? null,
        },
      });
    }
  }

  await createShifts(currentSchedule.id, currentMonday, CURRENT_WEEK_SHIFTS, "published");
  await createShifts(nextSchedule.id, nextMonday, NEXT_WEEK_SHIFTS, "draft");

  // publishedAt must be set AFTER shift creation (mirrors the publish API's own
  // ordering) so hasUnpublishedChanges — which compares shift.updatedAt against
  // schedule.publishedAt — doesn't flag a freshly-seeded published week as dirty.
  await prisma.schedule.update({
    where: { id: currentSchedule.id },
    data: { publishedAt: new Date(), publishedByUserId: manager.id },
  });

  // One pending time-off request: Alex Kim, Thu-Fri of next week.
  await prisma.timeOffRequest.create({
    data: {
      employeeProfileId: profileIdByEmail["alex@harborvine.test"],
      startDate: dateOnly(addDays(nextMonday, 3)),
      endDate: dateOnly(addDays(nextMonday, 4)),
      reason: "vacation",
      note: "Family visit",
      status: "pending",
    },
  });

  // One pending swap: Sam wants his Sunday shift covered, open to anyone qualified.
  const samSundayShift = await prisma.shift.findFirst({
    where: { scheduleId: currentSchedule.id, employeeProfileId: profileIdByEmail["sam@harborvine.test"] },
    orderBy: { startsAt: "desc" },
  });
  await prisma.swapRequest.create({
    data: {
      shiftId: samSundayShift!.id,
      requestingEmployeeProfileId: profileIdByEmail["sam@harborvine.test"],
      coveringEmployeeProfileId: null,
      note: "Something came up on Sunday. Can anyone cover?",
      status: "pending",
    },
  });

  // One pending open-shift claim: Chris claims next week's open Server shift.
  const openShift = await prisma.shift.findFirst({
    where: { scheduleId: nextSchedule.id, employeeProfileId: null },
  });
  await prisma.openShiftClaim.create({
    data: {
      shiftId: openShift!.id,
      employeeProfileId: profileIdByEmail["chris@harborvine.test"],
      status: "pending",
    },
  });

  // One pending demo invite with a fixed token so QA can open
  // /invite/demo-invite-riley directly. Safe to recreate: the old org
  // (and its invites) were deleted above.
  await prisma.invite.create({
    data: {
      organizationId: org.id,
      locationId: location.id,
      invitedByUserId: manager.id,
      positionId: positions["Server"],
      name: "Riley Quinn",
      phone: "+15550100111",
      token: "demo-invite-riley",
      status: "pending",
      expiresAt: addDays(new Date(), 14),
    },
  });

  const counts = {
    users: await prisma.user.count({ where: { organizationId: org.id } }),
    profiles: await prisma.employeeProfile.count({ where: { locationId: location.id } }),
    shifts: await prisma.shift.count({ where: { locationId: location.id } }),
  };
  console.log(`Seeded "${ORG_NAME}": ${counts.users} users, ${counts.profiles} profiles, ${counts.shifts} shifts.`);
  console.log("Manager login: jamie@harborvine.test / rosterhouse1");
  console.log("Employee login: maria@harborvine.test / rosterhouse1");
  console.log("Demo invite: http://localhost:3000/invite/demo-invite-riley");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
