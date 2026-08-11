import { z } from 'zod';

export const driverStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export type DriverStatus = z.infer<typeof driverStatusSchema>;

export const createDriverRequestSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(8),
  phone: z.string().min(1).optional(),
  licenseNumber: z.string().min(1).optional(),
  defaultBusId: z.string().uuid().optional(),
});
export type CreateDriverRequest = z.infer<typeof createDriverRequestSchema>;

export const updateDriverRequestSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(1).nullable().optional(),
  licenseNumber: z.string().min(1).nullable().optional(),
  defaultBusId: z.string().uuid().nullable().optional(),
  status: driverStatusSchema.optional(),
});
export type UpdateDriverRequest = z.infer<typeof updateDriverRequestSchema>;

export const driverResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  username: z.string(),
  phone: z.string().nullable(),
  licenseNumber: z.string().nullable(),
  defaultBusId: z.string().uuid().nullable(),
  status: driverStatusSchema,
});
export type DriverResponse = z.infer<typeof driverResponseSchema>;
