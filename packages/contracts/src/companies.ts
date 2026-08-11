import { z } from 'zod';

export const updateCompanyRequestSchema = z.object({
  name: z.string().min(1).optional(),
  brandPrimaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  liveThresholdSeconds: z.number().int().positive().optional(),
  staleThresholdSeconds: z.number().int().positive().optional(),
});
export type UpdateCompanyRequest = z.infer<typeof updateCompanyRequestSchema>;

export const companyProfileResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  timezone: z.string(),
  logoPath: z.string().nullable(),
  brandPrimaryColor: z.string().nullable(),
  liveThresholdSeconds: z.number(),
  staleThresholdSeconds: z.number(),
});
export type CompanyProfileResponse = z.infer<typeof companyProfileResponseSchema>;

export const domainKindSchema = z.enum(['PLATFORM_SUBDOMAIN', 'CUSTOM']);
export type DomainKind = z.infer<typeof domainKindSchema>;

export const createDomainRequestSchema = z.object({
  hostname: z
    .string()
    .min(1)
    .regex(/^[a-z0-9.-]+$/, 'hostname must be a valid DNS name'),
});
export type CreateDomainRequest = z.infer<typeof createDomainRequestSchema>;

export const domainResponseSchema = z.object({
  id: z.string().uuid(),
  hostname: z.string(),
  kind: domainKindSchema,
  isPrimary: z.boolean(),
  verifiedAt: z.string().datetime().nullable(),
});
export type DomainResponse = z.infer<typeof domainResponseSchema>;
