import { Controller, Get, Post, Body } from '@nestjs/common';
import { PolygonService } from './polygon.service';
import { NearService } from './near.service';
import { OrderService } from './order.service';
import { SwapDto } from './swap.dto';

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
  public async swapPolygonToNear(@Body() swapDto: SwapDto) {
    console.log('Received swap request:', swapDto);
    
    try {
      const order = await this.orderService.createOrder();
      console.log('Order created:', order);

      const immutables = await this.polygonService.deploySrcEscrow();
      console.log('Polygon src escrow deployed:', immutables);

      const details = await this.nearService.deployDestEscrow();
      console.log('NEAR dest escrow deployed:', details);

      const secret = await this.orderService.getOrderSecret();
      console.log('Order secret generated:', secret);

      const srcWithdraw = await this.polygonService.srcEscrowWithdraw();
      console.log('Polygon src withdraw:', srcWithdraw);

      const destWithdraw = await this.nearService.destEscrowWithdraw();
      console.log('NEAR dest withdraw:', destWithdraw);

      return {
        success: true,
        message: 'Swap from Polygon to NEAR initiated successfully',
        data: {
          order,
          immutables,
          details,
          secret,
          srcWithdraw,
          destWithdraw
        }
      };
    } catch (error) {
      console.error('Error processing swap:', error);
      return {
        success: false,
        message: 'Error processing swap',
        error: error.message
      };
    }
  }

  @Post('near-to-polygon')
  public async swapNearToPolygon(@Body() swapDto: SwapDto) {
    console.log('Received swap request:', swapDto);
    
    try {
      const order = await this.orderService.createOrder();
      console.log('Order created:', order);

      const immutables = await this.nearService.deploySrcEscrow();
      console.log('NEAR src escrow deployed:', immutables);

      const details = await this.polygonService.deployDestEscrow();
      console.log('Polygon dest escrow deployed:', details);

      const secret = await this.orderService.getOrderSecret();
      console.log('Order secret generated:', secret);

      const srcWithdraw = await this.nearService.srcEscrowWithdraw();
      console.log('NEAR src withdraw:', srcWithdraw);

      const destWithdraw = await this.polygonService.destEscrowWithdraw();
      console.log('Polygon dest withdraw:', destWithdraw);

      return {
        success: true,
        message: 'Swap from NEAR to Polygon initiated successfully',
        data: {
          order,
          immutables,
          details,
          secret,
          srcWithdraw,
          destWithdraw
        }
      };
    } catch (error) {
      console.error('Error processing swap:', error);
      return {
        success: false,
        message: 'Error processing swap',
        error: error.message
      };
    }
  }
}
