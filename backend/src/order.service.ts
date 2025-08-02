import { Injectable } from '@nestjs/common';
import { uint8ArrayToHex, UINT_40_MAX } from '@1inch/byte-utils';
import { createHash } from 'node:crypto';
import * as Sdk from '@1inch/cross-chain-sdk';
import { Address, LimitOrderV4Struct, NetworkEnum } from '@1inch/fusion-sdk';
import * as Constants from './constants';
import { CreateOrderDto } from './dto/order.dto';
import { MaxUint256, parseEther, parseUnits } from 'ethers';
import { Wallet } from './wallet';
import { ChainConfig, config } from './polygon/config';
import { getProvider } from './utils';

@Injectable()
export class OrderService {
  public async createOrder(
    createOrderdto: CreateOrderDto,
    escrowFactory: string = Constants.POLYGON_ESCROW_FACTORY,
    resolverContract: string = Constants.POLYGON_RESOLVER_CONTRACT_ADDRESS,
  ): Promise<{
    order: Sdk.CrossChainOrder;
    orderHash: string;
    signature: string;
    orderBuild: LimitOrderV4Struct;
  }> {
    const secret = this.getOrderSecret();

    const chainConfig: ChainConfig =
      createOrderdto.srcChainId === NetworkEnum.POLYGON
        ? config.chain['polygon']
        : config.chain['destination'];

    const { provider } = await getProvider(chainConfig);

    const makerWallet = new Wallet(createOrderdto.makerPk, provider);
    const srcTimestamp = BigInt((await provider.getBlock('latest'))!.timestamp);

    // NEED to handle from frontend
    await makerWallet.approveToken(
      createOrderdto.makerAssetAddress,
      config.chain.polygon.limitOrderProtocol,
      MaxUint256,
    );

    const order = Sdk.CrossChainOrder.new(
      new Address(escrowFactory),
      {
        salt: Sdk.randBigInt(1000n),
        maker: new Address(await makerWallet.getAddress()),
        makingAmount: parseUnits(
          `${createOrderdto.makingAmount}`,
          createOrderdto.makerAssetDecimals,
        ),
        takingAmount: parseUnits(
          `${createOrderdto.takingAmount}`,
          createOrderdto.takerAssetDecimals,
        ),
        makerAsset: new Address(createOrderdto.makerAssetAddress), // Source chain asset
        takerAsset: new Address(createOrderdto.takerAssetAddress), // Destination chain asset
      },
      {
        hashLock: Sdk.HashLock.forSingleFill(secret),
        timeLocks: Sdk.TimeLocks.new({
          srcWithdrawal: 10n, // 10sec finality lock for test
          srcPublicWithdrawal: 120n, // 2m for private withdrawal
          srcCancellation: 121n, // 1sec public withdrawal
          srcPublicCancellation: 122n, // 1sec private cancellation
          dstWithdrawal: 10n, // 10sec finality lock for test
          dstPublicWithdrawal: 100n, // 100sec private withdrawal
          dstCancellation: 101n, // 1sec public withdrawal
        }),
        srcChainId: createOrderdto.srcChainId,
        dstChainId: createOrderdto.destChainId,
        srcSafetyDeposit: parseEther('0.00001'),
        dstSafetyDeposit: parseEther('0.00001'),
      },
      {
        auction: new Sdk.AuctionDetails({
          initialRateBump: 0,
          points: [],
          duration: 120n,
          startTime: srcTimestamp,
        }),
        whitelist: [
          {
            address: new Address(resolverContract),
            allowFrom: 0n,
          },
        ],
        resolvingStartTime: 0n,
      },
      {
        nonce: Sdk.randBigInt(UINT_40_MAX),
        allowPartialFills: false,
        allowMultipleFills: false,
      },
    );

    const signature = await makerWallet.signOrder(
      createOrderdto.srcChainId,
      order,
    );
    const orderHash = order.getOrderHash(createOrderdto.srcChainId);

    return {
      order,
      orderHash,
      signature,
      orderBuild: order.build(),
    };
  }

  public getOrderSecret(): string {
    return uint8ArrayToHex(createHash('sha256').update('hackathon').digest());
  }
}
