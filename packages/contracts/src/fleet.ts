import { z } from 'zod';

export const busStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED']);
export type BusStatus = z.infer<typeof busStatusSchema>;

export const createBusRequestSchema = z.object({
  label: z.string().min(1),
  licensePlate: z.string().min(1).optional(),
});
export type CreateBusRequest = z.infer<typeof createBusRequestSchema>;

export const updateBusRequestSchema = z.object({
  label: z.string().min(1).optional(),
  licensePlate: z.string().min(1).nullable().optional(),
  status: busStatusSchema.optional(),
});
export type UpdateBusRequest = z.infer<typeof updateBusRequestSchema>;

export const busResponseSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  licensePlate: z.string().nullable(),
  status: busStatusSchema,
});
export type BusResponse = z.infer<typeof busResponseSchema>;
