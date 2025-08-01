import { Controller, Get, Post } from '@nestjs/common';
import { PolygonService } from './polygon.service';
import { NearService } from './near.service';
import { OrderService } from './order.service';

@Controller()
export class AppController {
  constructor(
    private readonly polygonService: PolygonService,
    private readonly nearService: NearService,
    private readonly orderService: OrderService,
  ) {}

  @Get()
  public async hello(): Promise<string> {
    return 'Hello from Polygon <-> Near Cross chain Resolver';
  }

  @Post('polygon-to-near')
  public async swapPolygonToNear() {
    const order = await this.orderService.createOrder();

    const immutables = await this.polygonService.deploySrcEscrow();
    const details = await this.nearService.deployDestEscrow();

    const secret = await this.orderService.getOrderSecret();

    const srcWithdraw = await this.polygonService.srcEscrowWithdraw();
    const destWithdraw = await this.nearService.destEscrowWithdraw();
  }

  @Post('near-to-polygon')
  public async swapNearToPolygon() {
    const order = await this.orderService.createOrder();

    const immutables = await this.nearService.deploySrcEscrow();
    const details = await this.polygonService.deployDestEscrow();

    const secret = await this.orderService.getOrderSecret();

    const srcWithdraw = await this.nearService.srcEscrowWithdraw();
    const destWithdraw = await this.polygonService.destEscrowWithdraw();
  }
}
