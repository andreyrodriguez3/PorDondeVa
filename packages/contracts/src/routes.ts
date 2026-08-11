import { z } from 'zod';

export const routeStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export type RouteStatus = z.infer<typeof routeStatusSchema>;

export const variantDirectionSchema = z.enum(['OUTBOUND', 'INBOUND']);
export type VariantDirection = z.infer<typeof variantDirectionSchema>;

// GeoJSON LineString, [lng, lat] pairs — matches SPECS.md §12 and RouteVariant.geometry.
export const lineStringGeometrySchema = z.object({
  type: z.literal('LineString'),
  coordinates: z
    .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
    .min(2),
});
export type LineStringGeometry = z.infer<typeof lineStringGeometrySchema>;

export const createRouteRequestSchema = z.object({
  name: z.string().min(1),
  originLabel: z.string().min(1),
  destinationLabel: z.string().min(1),
  publicSlug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'publicSlug must be lowercase letters, numbers, and hyphens only'),
});
export type CreateRouteRequest = z.infer<typeof createRouteRequestSchema>;

export const updateRouteRequestSchema = z.object({
  name: z.string().min(1).optional(),
  originLabel: z.string().min(1).optional(),
  destinationLabel: z.string().min(1).optional(),
  status: routeStatusSchema.optional(),
});
export type UpdateRouteRequest = z.infer<typeof updateRouteRequestSchema>;

export const routeResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  originLabel: z.string(),
  destinationLabel: z.string(),
  publicSlug: z.string(),
  status: routeStatusSchema,
});
export type RouteResponse = z.infer<typeof routeResponseSchema>;

export const createRouteVariantRequestSchema = z.object({
  name: z.string().min(1),
  direction: variantDirectionSchema,
  headsign: z.string().min(1),
  geometry: lineStringGeometrySchema,
  isDefault: z.boolean().optional(),
});
export type CreateRouteVariantRequest = z.infer<typeof createRouteVariantRequestSchema>;

export const updateRouteVariantRequestSchema = z.object({
  name: z.string().min(1).optional(),
  headsign: z.string().min(1).optional(),
  geometry: lineStringGeometrySchema.optional(),
  isDefault: z.boolean().optional(),
  status: routeStatusSchema.optional(),
});
export type UpdateRouteVariantRequest = z.infer<typeof updateRouteVariantRequestSchema>;

export const routeVariantResponseSchema = z.object({
  id: z.string().uuid(),
  routeId: z.string().uuid(),
  name: z.string(),
  direction: variantDirectionSchema,
  headsign: z.string(),
  geometry: lineStringGeometrySchema,
  isDefault: z.boolean(),
  status: routeStatusSchema,
});
export type RouteVariantResponse = z.infer<typeof routeVariantResponseSchema>;

export const createStopRequestSchema = z.object({
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type CreateStopRequest = z.infer<typeof createStopRequestSchema>;

export const updateStopRequestSchema = z.object({
  name: z.string().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
export type UpdateStopRequest = z.infer<typeof updateStopRequestSchema>;

export const stopResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});
export type StopResponse = z.infer<typeof stopResponseSchema>;

// The reorder endpoint takes the full ordered array of stop ids (ROADMAP.md §4.1 —
// route_variant_stops) and rewrites 1..N in one transaction.
export const reorderVariantStopsRequestSchema = z.object({
  stopIds: z.array(z.string().uuid()).min(1),
});
export type ReorderVariantStopsRequest = z.infer<typeof reorderVariantStopsRequestSchema>;

export const attachStopRequestSchema = z.object({
  stopId: z.string().uuid(),
});
export type AttachStopRequest = z.infer<typeof attachStopRequestSchema>;

export const createScheduleRequestSchema = z.object({
  // "HH:mm" 24h wall-clock time in the company's timezone (ROADMAP.md A10).
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'departureTime must be HH:mm'),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
});
export type CreateScheduleRequest = z.infer<typeof createScheduleRequestSchema>;

export const updateScheduleRequestSchema = z.object({
  departureTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'departureTime must be HH:mm')
    .optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  active: z.boolean().optional(),
});
export type UpdateScheduleRequest = z.infer<typeof updateScheduleRequestSchema>;

export const scheduleResponseSchema = z.object({
  id: z.string().uuid(),
  routeVariantId: z.string().uuid(),
  departureTime: z.string(),
  daysOfWeek: z.array(z.number()),
  active: z.boolean(),
});
export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;
