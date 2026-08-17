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
 * The allowlist below is what's left after migrating the mechanically-safe call sites
 * to `.scoped` — each remaining file falls into one of two structurally-legitimate
 * categories, not leftover debt:
 *
 *  - Tenant-resolution / bootstrap paths, where companyId is the *output* of the query,
 *    not a known input (auth login/session lookups, Host-header → company resolution,
 *    Caddy's on-demand-TLS domain check). These can't be scoped by definition.
 *  - Intentionally cross-tenant system jobs (the retention purge and stale-trip sweep in
 *    maintenance.service.ts), which operate across every company in one batch on
 *    purpose; scoping them would mean a per-company loop, changing their performance
 *    characteristics for no safety gain (they don't accept per-request tenant input).
 *  - SUPER_ADMIN's own module (platform.service.ts): SUPER_ADMIN is the one legitimate
 *    cross-tenant actor in the system (D-A7 in ROADMAP.md) — it creates companies and
 *    their first admin, which by definition isn't scoped to a single existing company.
 *
 * It should stay this short — a new entry here should come with the same kind of
 * justification, not just "didn't get to it yet".
 */
const SRC_ROOT = join(__dirname, '../../src');

const ALLOWED_RAW_CLIENT_FILES = new Set([
  'auth/auth.controller.ts',
  'auth/auth.service.ts',
  'live/live.gateway.ts',
  'maintenance/maintenance.service.ts',
  'platform/platform.service.ts',
  'public/public.service.ts',
  'tenancy/host-resolution.middleware.ts',
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
