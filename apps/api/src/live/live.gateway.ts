import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import type { PublicBusUpdate, SubscribeRequest } from '@tubus/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

// `cors.origin` below runs at socket-handshake time, evaluated once as a plain object
// passed straight to socket.io's Server constructor when this module loads — Nest's DI
// container (and the `PrismaService` singleton every other method here uses) isn't
// reachable from a decorator argument. A small dedicated client, checking the same
// "is this a verified tenant domain" question `resolveCompanyId` below already answers
// for the Host header, is the simplest way to apply it to the handshake's Origin too.
const corsPrisma = new PrismaClient();

async function isAllowedOrigin(origin: string | undefined): Promise<boolean> {
  if (!origin) return true; // non-browser clients (server-to-server, curl) send no Origin
  let hostname: string;
  try {
    hostname = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (process.env.NODE_ENV !== 'production' && hostname === 'localhost') return true;

  const domain = await corsPrisma.companyDomain.findUnique({
    where: { hostname },
    select: { verifiedAt: true },
  });
  return Boolean(domain?.verifiedAt);
}

/**
 * The public, unauthenticated live-tracking socket (README.md "How passenger live
 * tracking works"). The company is derived from the socket's Host header — never from
 * anything the client sends — and room membership follows the same rule, so a client
 * cannot subscribe its way into another company's data (D14 in ROADMAP.md). CORS origin
 * is scoped the same way: tenant domains are dynamic (custom domains registered after
 * deploy), so a static allowlist can't represent them — `isAllowedOrigin` above checks
 * each handshake's Origin against the same verified-domain table instead of `origin: '*'`.
 */
@WebSocketGateway({
  namespace: 'live',
  cors: {
    origin: (origin, callback) => {
      isAllowedOrigin(origin)
        .then((allowed) => callback(null, allowed))
        .catch(() => callback(null, false));
    },
  },
})
export class LiveGateway implements OnGatewayConnection {
  private readonly logger = new Logger(LiveGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const companyId = await this.resolveCompanyId(client);
    if (!companyId) {
      client.disconnect(true);
      return;
    }
    client.data.companyId = companyId;
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(client: Socket, payload: SubscribeRequest): Promise<void> {
    const companyId: string | undefined = client.data.companyId;
    if (!companyId || !payload?.routeSlug) return;

    const route = await this.prisma.scoped.route.findFirst({
      where: { companyId, publicSlug: payload.routeSlug },
      include: { variants: { select: { id: true } } },
    });
    if (!route) return;

    for (const variant of route.variants) {
      await client.join(roomName(companyId, variant.id));
    }
  }

  /** Called by the ingest path after a batch commits and the live state advances (D19). */
  emitBusUpdate(companyId: string, routeVariantId: string, update: PublicBusUpdate): void {
    this.server.to(roomName(companyId, routeVariantId)).emit('bus:update', update);
  }

  emitBusEnded(companyId: string, routeVariantId: string, tripId: string): void {
    this.server.to(roomName(companyId, routeVariantId)).emit('bus:ended', { tripId });
  }

  private async resolveCompanyId(client: Socket): Promise<string | null> {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    const overrideHeader = client.handshake.headers['x-tenant-host'];
    const hostname =
      nodeEnv !== 'production' && typeof overrideHeader === 'string'
        ? overrideHeader
        : (client.handshake.headers.host ?? '').split(':')[0];

    if (!hostname) return null;

    const domain = await this.prisma.companyDomain.findUnique({
      where: { hostname: hostname.toLowerCase() },
      select: { companyId: true, verifiedAt: true },
    });
    if (!domain || !domain.verifiedAt) {
      this.logger.debug(`Rejected socket connection for unknown host ${hostname}`);
      return null;
    }
    return domain.companyId;
  }
}

function roomName(companyId: string, routeVariantId: string): string {
  return `company:${companyId}:variant:${routeVariantId}`;
}
