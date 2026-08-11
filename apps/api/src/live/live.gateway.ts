import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { PublicBusUpdate, SubscribeRequest } from '@tubus/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * The public, unauthenticated live-tracking socket (README.md "How passenger live
 * tracking works"). The company is derived from the socket's Host header — never from
 * anything the client sends — and room membership follows the same rule, so a client
 * cannot subscribe its way into another company's data (D14 in ROADMAP.md).
 */
@WebSocketGateway({ namespace: 'live', cors: { origin: '*' } })
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
