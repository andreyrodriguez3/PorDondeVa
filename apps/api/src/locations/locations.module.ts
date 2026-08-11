import { Module } from '@nestjs/common';
import { LiveModule } from '../live/live.module';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  imports: [LiveModule],
  controllers: [LocationsController],
  providers: [LocationsService],
})
export class LocationsModule {}
