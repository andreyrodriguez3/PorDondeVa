import { z } from 'zod';
import { roleSchema } from './roles';
import { passwordSchema } from './password';

// Web surface: email + password (D15 — email is globally unique).
export const webLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type WebLoginRequest = z.infer<typeof webLoginRequestSchema>;

// Driver surface: company code + username + password (D20 — drivers have no email).
export const driverLoginRequestSchema = z.object({
  companyCode: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
});
export type DriverLoginRequest = z.infer<typeof driverLoginRequestSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const authenticatedUserSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  role: roleSchema,
  name: z.string(),
  email: z.string().email().nullable(),
  username: z.string().nullable(),
  mustChangePassword: z.boolean(),
});
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;

export const loginResponseSchema = z.object({
  tokens: authTokensSchema,
  user: authenticatedUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
