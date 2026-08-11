import { z } from 'zod';

// One point as the device reports it. Same shape for the live case (1-2 points) and an
// offline flush (up to 200), per D8 in ROADMAP.md.
export const locationPointSchema = z.object({
  clientPointId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().nonnegative().optional(),
  speedMps: z.number().nonnegative().optional(),
  bearingDeg: z.number().min(0).max(360).optional(),
  deviceTimestamp: z.string().datetime(),
});
export type LocationPoint = z.infer<typeof locationPointSchema>;

export const submitLocationsRequestSchema = z.object({
  points: z.array(locationPointSchema).min(1).max(200),
});
export type SubmitLocationsRequest = z.infer<typeof submitLocationsRequestSchema>;

export const pointOutcomeSchema = z.enum(['accepted', 'duplicate', 'rejected']);
export type PointOutcome = z.infer<typeof pointOutcomeSchema>;

export const submitLocationsResponseSchema = z.object({
  results: z.array(
    z.object({
      clientPointId: z.string().uuid(),
      outcome: pointOutcomeSchema,
      reason: z.string().optional(),
    }),
  ),
});
export type SubmitLocationsResponse = z.infer<typeof submitLocationsResponseSchema>;
