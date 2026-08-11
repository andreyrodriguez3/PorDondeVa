import { describe, expect, it } from 'vitest';
import { driverLoginRequestSchema, webLoginRequestSchema } from './auth';

describe('webLoginRequestSchema', () => {
  it('accepts a valid email and password', () => {
    const result = webLoginRequestSchema.safeParse({
      email: 'admin@tuanrl.example',
      password: 'hunter2',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed email', () => {
    const result = webLoginRequestSchema.safeParse({
      email: 'not-an-email',
      password: 'hunter2',
    });
    expect(result.success).toBe(false);
  });
});

describe('driverLoginRequestSchema', () => {
  it('requires companyCode, username and password', () => {
    const result = driverLoginRequestSchema.safeParse({
      companyCode: 'tuanrl',
      username: 'driver24',
      password: 'hunter2',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing companyCode', () => {
    const result = driverLoginRequestSchema.safeParse({
      username: 'driver24',
      password: 'hunter2',
    });
    expect(result.success).toBe(false);
  });
});
