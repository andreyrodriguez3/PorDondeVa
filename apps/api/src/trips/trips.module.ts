import { Module } from '@nestjs/common';
import { DriverController } from './driver.controller';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  controllers: [DriverController, TripsController],
  providers: [TripsService],
})
export class TripsModule {}
