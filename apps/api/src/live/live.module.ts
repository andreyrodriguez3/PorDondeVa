import { Module } from '@nestjs/common';
import { LiveController } from './live.controller';
import { LiveService } from './live.service';
import { LiveGateway } from './live.gateway';

@Module({
  controllers: [LiveController],
  providers: [LiveService, LiveGateway],
  exports: [LiveGateway, LiveService],
})
export class LiveModule {}
