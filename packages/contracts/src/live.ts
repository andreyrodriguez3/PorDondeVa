import { z } from 'zod';

export const busStateSchema = z.enum(['LIVE', 'STALE', 'OFFLINE']);
export type BusLiveState = z.infer<typeof busStateSchema>;

// The public payload — no driver name, phone, plate, or internal id (README.md "How
// passenger live tracking works"). Safe to broadcast to an unauthenticated socket.
export const publicBusUpdateSchema = z.object({
  tripId: z.string().uuid(),
  routeVariantId: z.string().uuid(),
  busLabel: z.string(),
  headsign: z.string(),
  lat: z.number(),
  lng: z.number(),
  bearingDeg: z.number().nullable(),
  speedMps: z.number().nullable(),
  accuracyM: z.number().nullable(),
  deviceTimestamp: z.string().datetime(),
  state: busStateSchema,
  // Next stop the bus hasn't reached yet, projected along the route line — null once
  // it's passed every stop, or if the fix couldn't be matched onto the line at all.
  nextStopId: z.string().uuid().nullable(),
  etaSeconds: z.number().int().nonnegative().nullable(),
});
export type PublicBusUpdate = z.infer<typeof publicBusUpdateSchema>;

export const busEndedEventSchema = z.object({ tripId: z.string().uuid() });
export type BusEndedEvent = z.infer<typeof busEndedEventSchema>;

export const subscribeRequestSchema = z.object({ routeSlug: z.string().min(1) });
export type SubscribeRequest = z.infer<typeof subscribeRequestSchema>;
