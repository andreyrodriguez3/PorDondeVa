import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';

const BATCH_SIZE = 10_000;

/**
 * Scheduled jobs that keep the system bounded (ROADMAP.md §4.3). None of these touch
 * the ingest hot path — they run independently on their own cadence.
 */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeOldLocations(): Promise<void> {
    const retentionDays = this.config.get<number>('LOCATION_RETENTION_DAYS')!;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    let totalDeleted = 0;
    for (;;) {
      const ids = await this.prisma.locationPoint.findMany({
        where: { serverTimestamp: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (ids.length === 0) break;

      await this.prisma.locationPoint.deleteMany({
        where: { id: { in: ids.map((row) => row.id) } },
      });
      totalDeleted += ids.length;
      if (ids.length < BATCH_SIZE) break;
    }

    if (totalDeleted > 0) {
      this.logger.log(`Purged ${totalDeleted} location points older than ${retentionDays} days.`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepStaleTrips(): Promise<void> {
    const timeoutMinutes = this.config.get<number>('TRIP_AUTO_END_MINUTES')!;
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const staleTrips = await this.prisma.trip.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { liveState: { deviceTimestamp: { lt: cutoff } } },
          { liveState: null, startedAt: { lt: cutoff } },
        ],
      },
      select: { id: true },
    });

    if (staleTrips.length === 0) return;

    const staleTripIds = staleTrips.map((t) => t.id);
    await this.prisma.$transaction([
      this.prisma.trip.updateMany({
        where: { id: { in: staleTripIds } },
        data: { status: 'COMPLETED', endedAt: new Date(), endReason: 'AUTO_TIMEOUT' },
      }),
      // See the matching note in TripsService.end() — TripLiveState survives a status
      // update (its cascade delete only fires on row deletion), so without this an
      // auto-timed-out trip keeps showing as a permanent offline "ghost" bus.
      this.prisma.tripLiveState.deleteMany({ where: { tripId: { in: staleTripIds } } }),
    ]);
    this.logger.log(
      `Auto-completed ${staleTrips.length} trip(s) silent for over ${timeoutMinutes} minutes.`,
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeExpiredTokens(): Promise<void> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      this.logger.log(`Purged ${result.count} expired refresh token(s).`);
    }
  }
}
