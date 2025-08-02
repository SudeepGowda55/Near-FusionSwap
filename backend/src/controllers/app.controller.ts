import { Controller, Get, Post, Body } from '@nestjs/common';
import { PolygonService } from '../polygon.service';
import { NearService } from '../near.service';
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
    console.log('📍 Scenario: Alice wants to send NEAR tokens (wants USDC on Polygon)');
    console.log('🔄 Flow: NEAR (source) → Polygon (destination)');
    console.log('');
    
    try {
      console.log('🔄 Step 1: Creating order...');
      const order = await this.orderService.createOrder();
      console.log('✅ Step 1 completed - Order:', order);

      console.log('🔄 Step 2: Alice (Maker) creating HTLC on NEAR (source chain)...');
      console.log('   - Alice SENDS NEAR tokens → Resolver RECEIVES NEAR tokens (as reimbursement)');
      const srcDetails = await this.nearService.deploySrcEscrow(
        request?.maker || 'flexlock-swap.testnet',
        request?.resolver || 'htlc.testnet',
        request?.fromAmount || '1000000000000000000000000'
      );
      console.log('✅ Step 2 completed - Source HTLC details:', srcDetails);

      console.log('🔄 Step 3: Resolver creating HTLC on Polygon (destination chain)...');
      console.log('   - Resolver SENDS USDC tokens → Alice RECEIVES USDC tokens');
      const destImmutables = await this.polygonService.deployDestEscrow();
      console.log('✅ Step 3 completed - Destination HTLC details:', destImmutables);

      console.log('🔄 Step 4: Getting order secret...');
      const secret = await this.orderService.getOrderSecret();
      console.log('✅ Step 4 completed - Secret:', secret);

      console.log('🔄 Step 5: Alice claiming USDC tokens on Polygon (destination)...');
      console.log('   - Alice (Final Recipient/Maker) claims USDC tokens');
      const destWithdraw = await this.polygonService.destEscrowWithdraw(
        destImmutables.htlc_id,
        destImmutables.secret
      );
      console.log('✅ Step 5 completed - Destination claim:', destWithdraw);

      console.log('🔄 Step 6: Alice claiming NEAR tokens on NEAR (source) - confirmation...');
      console.log('   - Alice (Maker) claims NEAR tokens back (confirms swap completion)');
      const srcWithdraw = await this.nearService.srcEscrowWithdraw(
        srcDetails.htlc_id,
        srcDetails.secret
      );
      console.log('✅ Step 6 completed - Source claim (confirmation):', srcWithdraw);

      console.log('🎉 ALL STEPS COMPLETED SUCCESSFULLY!');
      console.log('📝 Summary: Alice successfully swapped NEAR → USDC');
      console.log('   - Alice sent NEAR tokens to Resolver (reimbursement)');
      console.log('   - Alice received USDC tokens from Resolver');
      console.log('   - Alice confirmed completion by claiming NEAR back');

      return {
        success: true,
        swap_type: 'NEAR → USDC',
        scenario: 'NEAR as source chain, Polygon as destination chain',
        order,
        source_htlc: {
          chain: 'NEAR',
          role: 'Alice SENDS NEAR → Resolver RECEIVES NEAR (reimbursement)',
          details: srcDetails
        },
        destination_htlc: {
          chain: 'Polygon',
          role: 'Resolver SENDS USDC → Alice RECEIVES USDC',
          details: destImmutables
        },
        secret,
        destination_claim: destWithdraw,
        source_claim: srcWithdraw,
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
    console.log('📋 Request body:', JSON.stringify(request, null, 2));
    console.log('📍 Scenario: Alice wants to receive NEAR tokens (has USDC on Polygon)');
    console.log('🔄 Flow: Polygon (source) → NEAR (destination)');
    console.log('');
    
    try {
      console.log('🔄 Step 1: Creating order...');
      const order = await this.orderService.createOrder();
      console.log('✅ Step 1 completed - Order:', order);

      console.log('🔄 Step 2: Alice (Maker) creating HTLC on Polygon (source chain)...');
      console.log('   - Alice SENDS USDC tokens → Resolver RECEIVES USDC tokens (as reimbursement)');
      const srcImmutables = await this.polygonService.deploySrcEscrow();
      console.log('✅ Step 2 completed - Source HTLC details:', srcImmutables);

      console.log('🔄 Step 3: Resolver creating HTLC on NEAR (destination chain)...');
      console.log('   - Resolver SENDS NEAR tokens → Alice RECEIVES NEAR tokens');
      const destDetails = await this.nearService.deployDestEscrow(
        request?.resolver || 'htlc.testnet',
        request?.maker || 'flexlock-swap.testnet',
        request?.toAmount || '1000000000000000000000000'
      );
      console.log('✅ Step 3 completed - Destination HTLC details:', destDetails);

      console.log('🔄 Step 4: Getting order secret...');
      const secret = await this.orderService.getOrderSecret();
      console.log('✅ Step 4 completed - Secret:', secret);

      console.log('🔄 Step 5: Alice claiming NEAR tokens on NEAR (destination)...');
      console.log('   - Alice (Final Recipient/Maker) claims NEAR tokens');
      const destWithdraw = await this.nearService.destEscrowWithdraw(
        destDetails.htlc_id,
        destDetails.secret
      );
      console.log('✅ Step 5 completed - Destination claim:', destWithdraw);

      console.log('🔄 Step 6: Alice claiming USDC tokens on Polygon (source) - confirmation...');
      console.log('   - Alice (Maker) claims USDC tokens back (confirms swap completion)');
      const srcWithdraw = await this.polygonService.srcEscrowWithdraw(
        srcImmutables.htlc_id,
        srcImmutables.secret
      );
      console.log('✅ Step 6 completed - Source claim (confirmation):', srcWithdraw);

      console.log('🎉 ALL STEPS COMPLETED SUCCESSFULLY!');
      console.log('📝 Summary: Alice successfully swapped USDC → NEAR');
      console.log('   - Alice sent USDC tokens to Resolver (reimbursement)');
      console.log('   - Alice received NEAR tokens from Resolver');
      console.log('   - Alice confirmed completion by claiming USDC back');

      return {
        success: true,
        swap_type: 'USDC → NEAR',
        scenario: 'Polygon as source chain, NEAR as destination chain',
        order,
        source_htlc: {
          chain: 'Polygon',
          role: 'Alice SENDS USDC → Resolver RECEIVES USDC (reimbursement)',
          details: srcImmutables
        },
        destination_htlc: {
          chain: 'NEAR',
          role: 'Resolver SENDS NEAR → Alice RECEIVES NEAR',
          details: destDetails
        },
        secret,
        destination_claim: destWithdraw,
        source_claim: srcWithdraw,
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
