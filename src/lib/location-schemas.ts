import { z } from "zod";

/**
 * Full IANA zone set from the runtime. Built once at import; used to validate
 * `timezone` on the location-config PATCH. Changing this field retroactively
 * shifts all wall-clock rendering, so it must be a zone the runtime knows.
 */
export const IANA_TIMEZONES = new Set<string>(Intl.supportedValuesOf("timeZone"));

export const updateLocationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Enter a location name" }),
  timezone: z
    .string()
    .refine((value) => IANA_TIMEZONES.has(value), { message: "Choose a valid time zone" }),
  overtimeHoursPerWeek: z
    .number()
    .int({ message: "Overtime hours must be a whole number of 0 or more" })
    .min(0, { message: "Overtime hours must be a whole number of 0 or more" })
    .nullable(),
  address: z.string().trim().max(500).nullable(),
});

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
