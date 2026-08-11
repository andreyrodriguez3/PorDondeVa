// D14 layer 2 — a fail-closed runtime guard. It intercepts queries against tenant-scoped
// models and throws when no `companyId` is present, rather than silently injecting one.
// It cannot see nested writes or raw SQL (§4.2's hot path is scoped by hand and covered by
// tests instead) — it catches the common mistake of a forgotten `where`, nothing more.

export const TENANT_SCOPED_MODELS = new Set([
  'CompanyDomain',
  'User',
  'DriverProfile',
  'Bus',
  'Route',
  'RouteVariant',
  'Stop',
  'RouteVariantStop',
  'Schedule',
  'Trip',
  'LocationPoint',
  'TripLiveState',
  'TripIncident',
  'AuditLog',
]);

const READ_AND_WRITE_WHERE_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

const CREATE_OPERATIONS = new Set(['create']);
const CREATE_MANY_OPERATIONS = new Set(['createMany']);

export class MissingTenantScopeError extends Error {
  constructor(model: string, operation: string) {
    super(
      `Tenant scope guard: ${model}.${operation} was called without a companyId. ` +
        `Every query against a tenant-scoped model must be explicitly scoped (see D14 in ROADMAP.md).`,
    );
    this.name = 'MissingTenantScopeError';
  }
}

function whereHasCompanyId(where: unknown): boolean {
  return (
    typeof where === 'object' &&
    where !== null &&
    'companyId' in where &&
    (where as { companyId: unknown }).companyId !== undefined
  );
}

function dataHasCompanyId(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    'companyId' in data &&
    (data as { companyId: unknown }).companyId !== undefined
  );
}

/**
 * Checks a single Prisma operation's arguments for an explicit tenant scope.
 * Exported standalone (rather than only as a Prisma extension) so it can be unit tested
 * without a database connection.
 */
export function assertTenantScoped(model: string, operation: string, args: unknown): void {
  if (!TENANT_SCOPED_MODELS.has(model)) return;

  const a = (args ?? {}) as { where?: unknown; data?: unknown };

  if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
    // A unique lookup is only safe when the unique key itself carries the tenant scope,
    // e.g. the (companyId, username) or (companyId, label) compound uniques.
    if (!whereHasCompanyId(a.where)) {
      throw new MissingTenantScopeError(model, operation);
    }
    return;
  }

  if (READ_AND_WRITE_WHERE_OPERATIONS.has(operation)) {
    if (!whereHasCompanyId(a.where)) {
      throw new MissingTenantScopeError(model, operation);
    }
    return;
  }

  if (CREATE_OPERATIONS.has(operation)) {
    if (!dataHasCompanyId(a.data)) {
      throw new MissingTenantScopeError(model, operation);
    }
    return;
  }

  if (CREATE_MANY_OPERATIONS.has(operation)) {
    const list = Array.isArray(a.data) ? a.data : [a.data];
    if (list.length === 0 || list.some((row) => !dataHasCompanyId(row))) {
      throw new MissingTenantScopeError(model, operation);
    }
    return;
  }
}
