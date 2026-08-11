import { assertTenantScoped, MissingTenantScopeError } from './tenant-scope.guard';

describe('assertTenantScoped', () => {
  it('allows a non-tenant-scoped model through untouched', () => {
    expect(() => assertTenantScoped('Company', 'findMany', {})).not.toThrow();
  });

  it('throws when a tenant-scoped findMany has no companyId in where', () => {
    expect(() => assertTenantScoped('Bus', 'findMany', { where: { status: 'ACTIVE' } })).toThrow(
      MissingTenantScopeError,
    );
  });

  it('allows a tenant-scoped findMany when companyId is present', () => {
    expect(() =>
      assertTenantScoped('Bus', 'findMany', { where: { companyId: 'c1', status: 'ACTIVE' } }),
    ).not.toThrow();
  });

  it('throws on findUnique without companyId in the unique where', () => {
    expect(() => assertTenantScoped('User', 'findUnique', { where: { id: 'u1' } })).toThrow(
      MissingTenantScopeError,
    );
  });

  it('flags a compound-unique findUnique whose companyId is nested, not top-level', () => {
    // Known limit (D14): the guard only inspects the top level of `where`. A compound
    // unique like (companyId, username) must be paired with an explicit top-level
    // companyId by the caller, or wrapped in a service helper that adds one.
    expect(() =>
      assertTenantScoped('User', 'findUnique', {
        where: { companyId_username: { companyId: 'c1', username: 'driver24' } },
      }),
    ).toThrow(MissingTenantScopeError);
  });

  it('throws on create without companyId in data', () => {
    expect(() => assertTenantScoped('Bus', 'create', { data: { label: 'Bus 24' } })).toThrow(
      MissingTenantScopeError,
    );
  });

  it('allows create with companyId in data', () => {
    expect(() =>
      assertTenantScoped('Bus', 'create', { data: { companyId: 'c1', label: 'Bus 24' } }),
    ).not.toThrow();
  });

  it('throws on createMany when any row is missing companyId', () => {
    expect(() =>
      assertTenantScoped('Stop', 'createMany', {
        data: [{ companyId: 'c1', name: 'A' }, { name: 'B' }],
      }),
    ).toThrow(MissingTenantScopeError);
  });
});
