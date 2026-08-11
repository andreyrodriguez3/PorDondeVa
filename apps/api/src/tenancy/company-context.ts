import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenancyContext {
  /** null on the admin host — the tenant there comes from the session, not the hostname. */
  companyId: string | null;
  hostname: string;
  isAdminHost: boolean;
}

const storage = new AsyncLocalStorage<TenancyContext>();

export const CompanyContext = {
  run<T>(context: TenancyContext, fn: () => T): T {
    return storage.run(context, fn);
  },
  get(): TenancyContext | undefined {
    return storage.getStore();
  },
};
