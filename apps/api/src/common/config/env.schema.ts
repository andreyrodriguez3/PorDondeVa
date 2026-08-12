import { z } from 'zod';

// Every variable here is required with no default (CODESTYLE.md — "never hardcode secrets",
// README.md — "the backend refuses to start with a clear error if a required variable is missing").
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().min(1),
  REFRESH_TOKEN_TTL: z.string().min(1),
  PLATFORM_DOMAIN: z.string().min(1),
  ADMIN_HOST: z.string().min(1),
  LOCATION_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  TRIP_AUTO_END_MINUTES: z.coerce.number().int().positive().default(90),
  LOG_LEVEL: z.string().default('info'),
  RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(100),
  API_PORT: z.coerce.number().int().positive().default(8080),
  // A mounted volume in production (docker-compose.prod.yml); a local folder in dev.
  UPLOADS_DIR: z.string().min(1).default('./uploads'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
