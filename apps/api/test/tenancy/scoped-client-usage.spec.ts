import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { TENANT_SCOPED_MODELS } from '../../src/common/prisma/tenant-scope.guard';

/**
 * Static companion to tenant-scope.guard.ts (D14 layer 2). The guard only protects
 * `this.prisma.scoped.*` — `this.prisma.<model>.*` (the raw client, on the same
 * `PrismaService` instance) bypasses it completely and silently, since there's no
 * compile-time or runtime distinction between the two paths. This test scans the source
 * for that bypass so a NEW one can't be introduced without a deliberate decision.
 *
 * The allowlist below is today's known debt (~13 files, audited at the time this test
 * was added — none leak cross-tenant data today, they just aren't routed through
 * `.scoped`). It should shrink over time as those call sites get migrated, never grow
 * without someone consciously adding to it here.
 */
const SRC_ROOT = join(__dirname, '../../src');

const ALLOWED_RAW_CLIENT_FILES = new Set([
  'auth/auth.controller.ts',
  'auth/auth.service.ts',
  'buses/buses.service.ts',
  'companies/companies.service.ts',
  'drivers/drivers.service.ts',
  'live/live.gateway.ts',
  'maintenance/maintenance.service.ts',
  'public/public.service.ts',
  'qr/qr.service.ts',
  'routes/routes.service.ts',
  'schedules/schedules.service.ts',
  'stops/stops.service.ts',
  'tenancy/host-resolution.middleware.ts',
  'trips/trips.service.ts',
]);

function pascalToCamel(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function listTsFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...listTsFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      files.push(full);
    }
  }
  return files;
}

describe('Tenant-scoped Prisma models are only accessed via prisma.scoped', () => {
  const rawClientPatterns = [...TENANT_SCOPED_MODELS].map((model) => ({
    model,
    pattern: new RegExp(`this\\.prisma\\.${pascalToCamel(model)}\\.`, 'g'),
  }));

  it('has no new raw-client access to a tenant-scoped model outside the allowlist', () => {
    const violations: string[] = [];

    for (const absPath of listTsFiles(SRC_ROOT)) {
      const relPath = relative(SRC_ROOT, absPath).replace(/\\/g, '/');
      if (ALLOWED_RAW_CLIENT_FILES.has(relPath)) continue;

      const content = readFileSync(absPath, 'utf8');
      for (const { model, pattern } of rawClientPatterns) {
        if (pattern.test(content)) {
          violations.push(`${relPath}: raw prisma.${pascalToCamel(model)} (model ${model})`);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Found tenant-scoped models accessed via the raw Prisma client outside the ` +
          `allowlist in scoped-client-usage.spec.ts. Use prisma.scoped.* instead, or if ` +
          `this really is safe, add the file to ALLOWED_RAW_CLIENT_FILES with a comment ` +
          `explaining why:\n${violations.join('\n')}`,
      );
    }
  });

  it('the allowlist has no stale entries for files that no longer exist', () => {
    const existing = new Set(
      listTsFiles(SRC_ROOT).map((absPath) => relative(SRC_ROOT, absPath).replace(/\\/g, '/')),
    );
    const stale = [...ALLOWED_RAW_CLIENT_FILES].filter((f) => !existing.has(f));
    expect(stale).toEqual([]);
  });
});
