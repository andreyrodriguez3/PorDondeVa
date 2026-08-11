import { validateEnv } from './env.schema';

const validConfig = {
  DATABASE_URL: 'postgresql://tubus:tubus@localhost:5432/tubus',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL: '30d',
  PLATFORM_DOMAIN: 'tubus.example',
  ADMIN_HOST: 'admin.tubus.example',
};

describe('validateEnv', () => {
  it('accepts a complete configuration and applies defaults', () => {
    const env = validateEnv(validConfig);
    expect(env.LOCATION_RETENTION_DAYS).toBe(90);
    expect(env.TRIP_AUTO_END_MINUTES).toBe(90);
    expect(env.API_PORT).toBe(8080);
  });

  it('throws with a readable message when a required secret is missing', () => {
    const { JWT_ACCESS_SECRET: _omit, ...incomplete } = validConfig;
    expect(() => validateEnv(incomplete)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects a JWT secret that is too short', () => {
    expect(() => validateEnv({ ...validConfig, JWT_ACCESS_SECRET: 'short' })).toThrow();
  });
});
