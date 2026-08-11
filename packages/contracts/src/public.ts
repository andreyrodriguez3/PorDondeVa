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

export const publicVariantSchema = z.object({
  id: z.string().uuid(),
  direction: variantDirectionSchema,
  headsign: z.string(),
  isDefault: z.boolean(),
  geometry: lineStringGeometrySchema,
  stops: z.array(publicStopSchema),
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
