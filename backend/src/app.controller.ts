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
      console.log('🚀 Starting Polygon to NEAR swap...');

      // MANDATORY: Approve the token transfer before creating an order
      await this.polygonService.initialize();

      console.log('📝 Creating order on Polygon...');
      const { order, orderHash, signature, hashLock, orderBuild } =
        await this.orderService.createOrder(
          createOrderDto,
          this.polygonService.src.escrowFactory,
          this.polygonService.src.resolver,
        );
      console.log('✅ Order created:', orderBuild);

      console.log('🏗️ Deploying source escrow on Polygon...');
      const srcEscrowEvent = await this.polygonService.deploySrcEscrow(
        order,
        orderHash,
        signature,
      );
      console.log('✅ Polygon src escrow deployed');

      console.log('🏗️ Deploying destination escrow on NEAR...');
      const nearDestEscrow = await this.nearService.deployDestEscrow(
        'htlc.testnet', // resolver
        createOrderDto.makerNearAccountId, // maker
        createOrderDto.takingAmount.toString(), // amount
        hashLock, // hashLock from order
      );
      console.log('✅ NEAR dest escrow deployed:', nearDestEscrow);

      // TODO add function to validate balances
      const secret = this.orderService.getOrderSecret();

      console.log('Waiting for 10 seconds before withdrawing funds...');
      await new Promise((resolve) => setTimeout(resolve, 10000));

      console.log('💰 Withdrawing from Polygon source escrow...');
      await this.polygonService.srcEscrowWithdraw(srcEscrowEvent, secret);
      console.log('✅ Polygon src withdraw completed:');

      console.log('💰 Withdrawing from NEAR destination escrow...');
      const nearWithdraw = await this.nearService.destEscrowWithdraw(
        nearDestEscrow.htlc_id,
        secret,
      );
      console.log('✅ NEAR dest withdraw completed:', nearWithdraw);
      console.log('🎉 Polygon to NEAR swap completed successfully!');

      return {
        success: true,
        message: 'Swap from Polygon to NEAR successfully',
        data: {
          orderHash,
          hashLock,
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
      console.log('🚀 Starting NEAR to Polygon swap...');

      await this.polygonService.initialize();

      console.log('🔐 Generating secret and hash lock...');
      const secret = this.orderService.getOrderSecret();

      // Generate keccak256 hash of the secret as required for cross-chain compatibility
      const { keccak256 } = await import('ethers');
      const hashLock = keccak256(secret);
      console.log('✅ Generated hashLock:', hashLock);

      console.log('🏗️ Phase 2: User creating HTLC on NEAR (source chain)...');
      // Phase 2: User (goldrogerswap.testnet) creates HTLC on NEAR as source
      // User funds the HTLC with NEAR tokens and sets is_destination = false

      // Convert amount to yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
      const { parseUnits } = await import('ethers');
      const nearAmountInYocto = parseUnits(
        createOrderDto.makingAmount.toString(),
        24,
      );
      console.log('💰 Amount in yoctoNEAR:', nearAmountInYocto.toString());

      const nearSrcEscrow = await this.nearService.deploySrcEscrow(
        'goldrogerswap.testnet', // user (maker)
        'htlc.testnet', // resolver
        nearAmountInYocto.toString(), // amount in yoctoNEAR
        hashLock, // Use the keccak256 hash
      );
      console.log('✅ NEAR src escrow deployed by user:', nearSrcEscrow);

      console.log('📝 Creating order with generated hash lock...');
      const order = OrderDto.fromCreateOrderDto(createOrderDto, hashLock);

      console.log('🔍 Order details:', {
        createOrderDto: createOrderDto,
        hashLock: hashLock,
      });

      const {
        newDstImmutables,
        newDstImmutablesComplement,
        dstDeployedAt,
        dstEscrowAddress,
      } = await this.polygonService.deployDestEscrow(order, hashLock);
      console.log('Polygon dest escrow deployed');

      console.log('Waiting for 10 seconds before withdrawing funds...');
      await new Promise((resolve) => setTimeout(resolve, 10000));

      console.log('💰 User reclaiming their NEAR tokens...');
      // User withdraws their own NEAR tokens from source escrow (they are the resolver in this HTLC)
      const srcWithdraw = await this.nearService.srcEscrowWithdraw(
        nearSrcEscrow.htlc_id,
        secret,
      );
      console.log('✅ NEAR src withdraw completed:', srcWithdraw);

      await this.polygonService.destEscrowWithdraw(
        newDstImmutables,
        newDstImmutablesComplement,
        secret,
        dstDeployedAt,
        dstEscrowAddress,
      );

      console.log('🎉 NEAR to Polygon swap completed successfully!');

      return {
        success: true,
        message: 'Swap from NEAR to Polygon completed successfully',
        data: {
          secret,
          hashLock,
          nearHtlcId: nearSrcEscrow.htlc_id,
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
