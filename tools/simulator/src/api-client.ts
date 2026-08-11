import type {
  DriverAssignmentResponse,
  LocationPoint,
  LoginResponse,
  SubmitLocationsResponse,
  TripResponse,
} from '@tubus/contracts';

export class ApiClient {
  private accessToken: string | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly adminHost: string,
  ) {}

  async loginAsDriver(companyCode: string, username: string, password: string): Promise<void> {
    const res = await this.request<LoginResponse>('/auth/driver/login', {
      method: 'POST',
      body: { companyCode, username, password },
    });
    this.accessToken = res.tokens.accessToken;
  }

  getAssignment(): Promise<DriverAssignmentResponse> {
    return this.request('/driver/assignment');
  }

  getActiveTrip(): Promise<TripResponse | null> {
    return this.request('/driver/trips/active');
  }

  startTrip(routeVariantId: string, busId?: string): Promise<TripResponse> {
    return this.request('/driver/trips', { method: 'POST', body: { routeVariantId, busId } });
  }

  endTrip(tripId: string): Promise<void> {
    return this.request(`/driver/trips/${tripId}/end`, { method: 'POST' });
  }

  submitLocations(tripId: string, points: LocationPoint[]): Promise<SubmitLocationsResponse> {
    return this.request(`/driver/trips/${tripId}/locations`, {
      method: 'POST',
      body: { points },
    });
  }

  private async request<T>(
    path: string,
    opts: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Host': this.adminHost,
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${opts.method ?? 'GET'} ${path} -> ${res.status}: ${text}`);
    }
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return undefined as T;
    }
    return res.json() as Promise<T>;
  }
}
