import { z } from 'zod';
import { lineStringGeometrySchema, variantDirectionSchema } from './routes';
import { publicBusUpdateSchema } from './live';

export const publicCompanySchema = z.object({
  name: z.string(),
  slug: z.string(),
  logoPath: z.string().nullable(),
  brandPrimaryColor: z.string().nullable(),
});
export type PublicCompany = z.infer<typeof publicCompanySchema>;

export const publicRouteSummarySchema = z.object({
  slug: z.string(),
  name: z.string(),
  originLabel: z.string(),
  destinationLabel: z.string(),
  activeBusCount: z.number().int(),
});
export type PublicRouteSummary = z.infer<typeof publicRouteSummarySchema>;

export const publicStopSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  sequence: z.number().int(),
});
export type PublicStop = z.infer<typeof publicStopSchema>;

export const publicScheduleSchema = z.object({
  departureTime: z.string(), // "HH:mm", wall-clock in the company's timezone
  daysOfWeek: z.array(z.number().int().min(0).max(6)), // 0 = Sunday
});
export type PublicSchedule = z.infer<typeof publicScheduleSchema>;

export const publicVariantSchema = z.object({
  id: z.string().uuid(),
  direction: variantDirectionSchema,
  headsign: z.string(),
  isDefault: z.boolean(),
  geometry: lineStringGeometrySchema,
  stops: z.array(publicStopSchema),
  schedules: z.array(publicScheduleSchema),
});
export type PublicVariant = z.infer<typeof publicVariantSchema>;

export const publicRouteDetailSchema = z.object({
  slug: z.string(),
  name: z.string(),
  originLabel: z.string(),
  destinationLabel: z.string(),
  variants: z.array(publicVariantSchema),
});
export type PublicRouteDetail = z.infer<typeof publicRouteDetailSchema>;

export const publicRouteLiveSchema = z.object({
  buses: z.array(publicBusUpdateSchema),
});
export type PublicRouteLive = z.infer<typeof publicRouteLiveSchema>;

// A Stop is a shared physical location — the same one can sit on several routes/
// variants (an intersection two different lines both pass through), so its detail
// lists every route serving it rather than assuming just one.
export const publicStopRouteSchema = z.object({
  routeSlug: z.string(),
  routeName: z.string(),
  headsign: z.string(),
});
export type PublicStopRoute = z.infer<typeof publicStopRouteSchema>;

export const publicStopDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  routes: z.array(publicStopRouteSchema),
});
export type PublicStopDetail = z.infer<typeof publicStopDetailSchema>;

export const publicApproachingBusSchema = publicBusUpdateSchema.extend({
  routeSlug: z.string(),
  routeName: z.string(),
});
export type PublicApproachingBus = z.infer<typeof publicApproachingBusSchema>;

export const publicStopLiveSchema = z.object({
  approaching: z.array(publicApproachingBusSchema),
});
export type PublicStopLive = z.infer<typeof publicStopLiveSchema>;
