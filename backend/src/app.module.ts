import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PolygonService } from './polygon.service';
import { NearService } from './near.service';
import { OrderService } from './order.service';

@Module({
  controllers: [AppController],
  providers: [PolygonService, NearService, OrderService],
})
export class AppModule {}
