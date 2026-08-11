import { z } from 'zod';

export const busStateSchema = z.enum(['LIVE', 'STALE', 'OFFLINE']);
export type BusLiveState = z.infer<typeof busStateSchema>;

// The public payload — no driver name, phone, plate, or internal id (README.md "How
// passenger live tracking works"). Safe to broadcast to an unauthenticated socket.
export const publicBusUpdateSchema = z.object({
  tripId: z.string().uuid(),
  busLabel: z.string(),
  headsign: z.string(),
  lat: z.number(),
  lng: z.number(),
  bearingDeg: z.number().nullable(),
  speedMps: z.number().nullable(),
  accuracyM: z.number().nullable(),
  deviceTimestamp: z.string().datetime(),
  state: busStateSchema,
});
export type PublicBusUpdate = z.infer<typeof publicBusUpdateSchema>;

export const busEndedEventSchema = z.object({ tripId: z.string().uuid() });
export type BusEndedEvent = z.infer<typeof busEndedEventSchema>;

export const subscribeRequestSchema = z.object({ routeSlug: z.string().min(1) });
export type SubscribeRequest = z.infer<typeof subscribeRequestSchema>;
