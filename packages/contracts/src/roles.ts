import { z } from 'zod';

export const roleSchema = z.enum(['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATOR', 'DRIVER']);

export type Role = z.infer<typeof roleSchema>;
