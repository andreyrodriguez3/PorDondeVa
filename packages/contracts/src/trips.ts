import { z } from 'zod';
import { lineStringGeometrySchema } from './routes';

export const tripStatusSchema = z.enum(['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED']);
export type TripStatus = z.infer<typeof tripStatusSchema>;

export const startTripRequestSchema = z.object({
  routeVariantId: z.string().uuid(),
  busId: z.string().uuid().optional(),
});
export type StartTripRequest = z.infer<typeof startTripRequestSchema>;

export const tripResponseSchema = z.object({
  id: z.string().uuid(),
  routeId: z.string().uuid(),
  routeVariantId: z.string().uuid(),
  busId: z.string().uuid(),
  driverUserId: z.string().uuid(),
  status: tripStatusSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  rejectedPointCount: z.number().int(),
  // Denormalized labels so the admin UI never has to resolve a UUID by hand.
  busLabel: z.string(),
  driverName: z.string(),
  routeName: z.string(),
  variantHeadsign: z.string(),
});
export type TripResponse = z.infer<typeof tripResponseSchema>;

export const locationHistoryPointSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracyM: z.number().nullable(),
  speedMps: z.number().nullable(),
  bearingDeg: z.number().nullable(),
  deviceTimestamp: z.string().datetime(),
});
export type LocationHistoryPoint = z.infer<typeof locationHistoryPointSchema>;

export const driverAssignmentResponseSchema = z.object({
  defaultBusId: z.string().uuid().nullable(),
  buses: z.array(z.object({ id: z.string().uuid(), label: z.string() })),
  routes: z.array(
    z.object({
      routeId: z.string().uuid(),
      routeName: z.string(),
      routeSlug: z.string(),
      variantId: z.string().uuid(),
      variantName: z.string(),
      headsign: z.string(),
      geometry: lineStringGeometrySchema,
    }),
  ),
});
export type DriverAssignmentResponse = z.infer<typeof driverAssignmentResponseSchema>;
