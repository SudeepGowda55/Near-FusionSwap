import { Controller, Get, Post, Body } from '@nestjs/common';
import { PolygonService } from '../polygon.service';
import { NearService } from '../services/near.service';
import { OrderService } from '../order.service';

interface SwapRequest {
  fromChain: 'polygon' | 'near';
  toChain: 'polygon' | 'near';
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  maker: string;
  resolver: string;
}

@Controller()
export class AppController {
  constructor(
    private readonly polygonService: PolygonService,
    private readonly nearService: NearService,
    private readonly orderService: OrderService,
  ) {}

  @Get()
  public async hello(): Promise<string> {
    return 'Hello from Polygon <-> NEAR Cross chain Resolver';
  }

  @Post('near-to-polygon')
  public async swapNearToPolygon(@Body() request?: SwapRequest) {
    console.log('🚨🚨🚨 NEAR-TO-POLYGON ENDPOINT HIT! 🚨🚨🚨');
    console.log('📅 Timestamp:', new Date().toISOString());
    console.log('📋 Request body:', JSON.stringify(request, null, 2));
    
    try {
      console.log('🔄 Step 1: About to create order...');
      const order = await this.orderService.createOrder();
      console.log('✅ Step 1 completed - Order:', order);

      console.log('🔄 Step 2: About to deploy source escrow...');
      // ✅ Fixed: Now passes parameters correctly
      const srcDetails = await this.nearService.deploySrcEscrow(
        request?.maker || 'flexlock-swap.testnet',
        request?.resolver || 'htlc.testnet',
        request?.fromAmount || '1000000000000000000000000'
      );
      console.log('✅ Step 2 completed - Source details:', srcDetails);

      console.log('🔄 Step 3: About to deploy dest escrow...');
      const destImmutables = await this.polygonService.deployDestEscrow();
      console.log('✅ Step 3 completed - Dest details:', destImmutables);

      console.log('🔄 Step 4: About to get order secret...');
      const secret = await this.orderService.getOrderSecret();
      console.log('✅ Step 4 completed - Secret:', secret);

      console.log('🔄 Step 5: About to do dest withdraw...');
      const destWithdraw = await this.polygonService.destEscrowWithdraw();
      console.log('✅ Step 5 completed - Dest withdraw:', destWithdraw);

      console.log('🔄 Step 6: About to do src withdraw...');
      // ✅ Fixed: Now uses claim method directly with proper parameters
      const srcWithdraw = await this.nearService.claim(
        srcDetails.htlc_id,
        srcDetails.secret
      );
      console.log('✅ Step 6 completed - Src withdraw:', srcWithdraw);

      console.log('🎉 ALL STEPS COMPLETED SUCCESSFULLY!');

      return {
        success: true,
        swap_type: 'NEAR -> WETH',
        order,
        src_escrow: srcDetails,
        dest_escrow: destImmutables,
        secret,
        dest_withdraw: destWithdraw,
        src_withdraw: srcWithdraw,
        message: 'NEAR to Polygon swap completed successfully'
      };
    } catch (error) {
      console.error('💥 ERROR IN CONTROLLER:', error);
      console.error('💥 ERROR STACK:', error.stack);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'NEAR to Polygon swap failed'
      };
    }
  }

  @Post('polygon-to-near') 
  public async swapPolygonToNear(@Body() request?: SwapRequest) {
    console.log('🚨🚨🚨 POLYGON-TO-NEAR ENDPOINT HIT! 🚨🚨🚨');
    console.log('📅 Timestamp:', new Date().toISOString());
    
    try {
      console.log('🔄 Step 1: About to create order...');
      const order = await this.orderService.createOrder();
      console.log('✅ Step 1 completed - Order:', order);

      console.log('🔄 Step 2: About to deploy dest escrow...');
      // ✅ Fixed: Now passes parameters correctly
      const destDetails = await this.nearService.deployDestEscrow(
        request?.resolver || 'htlc.testnet',
        request?.maker || 'flexlock-swap.testnet',
        request?.toAmount || '1000000000000000000000000'
      );
      console.log('✅ Step 2 completed - Dest details:', destDetails);

      console.log('🔄 Step 3: About to deploy src escrow...');
      const srcImmutables = await this.polygonService.deploySrcEscrow();
      console.log('✅ Step 3 completed - Src details:', srcImmutables);

      console.log('🔄 Step 4: About to get order secret...');
      const secret = await this.orderService.getOrderSecret();
      console.log('✅ Step 4 completed - Secret:', secret);

      console.log('🔄 Step 5: About to do dest withdraw...');
      // ✅ Fixed: Now uses claim method directly with proper parameters
      const destWithdraw = await this.nearService.claim(
        destDetails.htlc_id,
        destDetails.hash
      );
      console.log('✅ Step 5 completed - Dest withdraw:', destWithdraw);

      console.log('🔄 Step 6: About to do src withdraw...');
      const srcWithdraw = await this.polygonService.srcEscrowWithdraw();
      console.log('✅ Step 6 completed - Src withdraw:', srcWithdraw);

      console.log('🎉 ALL STEPS COMPLETED SUCCESSFULLY!');

      return {
        success: true,
        swap_type: 'WETH -> NEAR',
        order,
        dest_escrow: destDetails,
        src_escrow: srcImmutables,
        secret,
        dest_withdraw: destWithdraw,
        src_withdraw: srcWithdraw,
        message: 'Polygon to NEAR swap completed successfully'
      };
    } catch (error) {
      console.error('💥 ERROR IN CONTROLLER:', error);
      console.error('💥 ERROR STACK:', error.stack);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Polygon to NEAR swap failed'
      };
    }
  }
}
