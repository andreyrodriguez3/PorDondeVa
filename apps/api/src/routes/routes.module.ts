import { Module } from '@nestjs/common';
import { RoutesController } from './routes.controller';
import { VariantsController } from './variants.controller';
import { RoutesService } from './routes.service';

@Module({
  controllers: [RoutesController, VariantsController],
  providers: [RoutesService],
})
export class RoutesModule {}
