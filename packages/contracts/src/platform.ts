import { z } from 'zod';

// A20 — SUPER_ADMIN is a platform-level role (company_id IS NULL) restricted to
// company/domain lifecycle, never a company's operational data (D-A7 in ROADMAP.md).
export const createCompanyRequestSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers, and hyphens'),
  timezone: z.string().min(1).default('America/Costa_Rica'),
});
export type CreateCompanyRequest = z.infer<typeof createCompanyRequestSchema>;

export const companyStatusSchema = z.enum(['ACTIVE', 'SUSPENDED']);
export type CompanyStatus = z.infer<typeof companyStatusSchema>;

export const updateCompanyStatusRequestSchema = z.object({
  status: companyStatusSchema,
});
export type UpdateCompanyStatusRequest = z.infer<typeof updateCompanyStatusRequestSchema>;

export const platformCompanyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  timezone: z.string(),
  status: companyStatusSchema,
  createdAt: z.string().datetime(),
});
export type PlatformCompanyResponse = z.infer<typeof platformCompanyResponseSchema>;

export const createCompanyAdminRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});
export type CreateCompanyAdminRequest = z.infer<typeof createCompanyAdminRequestSchema>;

// The one-time password is only ever present in this response — never stored in
// plaintext, never retrievable again (mirrors A21's admin-issued driver reset).
export const createCompanyAdminResponseSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  temporaryPassword: z.string(),
});
export type CreateCompanyAdminResponse = z.infer<typeof createCompanyAdminResponseSchema>;
