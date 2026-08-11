import { Module } from '@nestjs/common';
import { LiveModule } from '../live/live.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [LiveModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
