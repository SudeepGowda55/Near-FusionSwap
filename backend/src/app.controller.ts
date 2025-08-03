import { Controller, Get, Post, Body } from '@nestjs/common';
import { PolygonService } from './polygon.service';
import { NearService } from './near.service';
import { OrderService } from './order.service';
import { CreateOrderDto, OrderDto } from './dto/order.dto';

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
  public async swapPolygonToNear(@Body() createOrderDto: CreateOrderDto) {
    try {
      // MANDATORY: Approve the token transfer before creating an order
      await this.polygonService.initialize();

      const { order, orderHash, signature, hashLock, orderBuild } =
        await this.orderService.createOrder(
          createOrderDto,
          this.polygonService.src.escrowFactory,
          this.polygonService.src.resolver,
        );
      console.log('Order created:', orderBuild);

      const srcEscrowEvent = await this.polygonService.deploySrcEscrow(
        order,
        orderHash,
        signature,
      );

      const details = await this.nearService.deployDestEscrow();
      console.log('NEAR dest escrow deployed:', details);

      // TODO add function to validate balances
      const secret = this.orderService.getOrderSecret();

      await this.polygonService.srcEscrowWithdraw(srcEscrowEvent, secret);
      console.log('Polygon src withdraw completed');

      await this.nearService.destEscrowWithdraw();
      console.log('NEAR dest withdraw completed');

      return {
        success: true,
        message: 'Swap from Polygon to NEAR successfully',
        data: {
          order,
          secret,
        },
      };
    } catch (error) {
      console.error('Error processing swap:', error);
      return {
        success: false,
        message: 'Error processing swap',
        error: error.message,
      };
    }
  }

  @Post('near-to-polygon')
  public async swapNearToPolygon(@Body() createOrderDto: CreateOrderDto) {
    try {
      await this.polygonService.initialize();

      const secret = this.orderService.getOrderSecret();

      const { hash } = await this.nearService.deploySrcEscrow();
      console.log('NEAR src escrow deployed');

      // this hash and hashlock should be same

      const hashLock =
        '0x8b1d2da4868c646e5eaa1ce360da51ddfec51ee2eae96d1bac442f0462979f02';

      const order = OrderDto.fromCreateOrderDto(createOrderDto, hashLock);

      const { newDstImmutables, newDstImmutablesComplement, dstDeployedAt } =
        await this.polygonService.deployDestEscrow(order, hashLock);
      console.log('Polygon dest escrow deployed');

      const srcWithdraw = await this.nearService.srcEscrowWithdraw();
      console.log('NEAR src withdraw:', srcWithdraw);

      await this.polygonService.destEscrowWithdraw(
        newDstImmutables,
        newDstImmutablesComplement,
        secret,
        dstDeployedAt,
      );

      return {
        success: true,
        message: 'Swap from NEAR to Polygon initiated successfully',
        data: {
          order,
          secret,
        },
      };
    } catch (error) {
      console.error('Error processing swap:', error);
      return {
        success: false,
        message: 'Error processing swap',
        error: error.message,
      };
    }
  }
}
