import { Module } from '@nestjs/common';
import { StopsController } from './stops.controller';
import { VariantStopsController } from './variant-stops.controller';
import { StopsService } from './stops.service';

@Module({
  controllers: [StopsController, VariantStopsController],
  providers: [StopsService],
})
export class StopsModule {}
