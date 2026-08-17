import { z } from 'zod';

// Shared by every path that sets a password (driver creation, admin-issued reset,
// self-service change) so a policy update only happens in one place. Length alone
// stops nothing against a wordlist; requiring a letter and a digit costs the user
// almost nothing but rules out the pure-digit and pure-word passwords that dominate
// breach corpora.
export const passwordSchema = z
  .string()
  .min(10)
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one digit.');
