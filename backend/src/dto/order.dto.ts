import * as Sdk from '@1inch/cross-chain-sdk';

export class OrderDto {
  orderHash: string;
  hashlock: string;
  maker: string;
  taker: string;
  token: string;
  amount: string;
  safetyDeposit: string;
  timelocks: Sdk.TimeLocks;

  public static fromCreateOrderDto(
    createOrderDto: CreateOrderDto,
    hashLock: string,
  ): OrderDto {
    const order = new OrderDto();
    order.orderHash = hashLock; // Need to change this to actual hash generation logic
    order.hashlock = hashLock;
    order.maker = createOrderDto.makerEvmAddress;
    order.token = createOrderDto.takerAssetAddress;
    order.amount = `${createOrderDto.takingAmount}`;

    const timeLocks = Sdk.TimeLocks.new({
      srcWithdrawal: 10n, // 10sec finality lock for test
      srcPublicWithdrawal: 120n, // 2m for private withdrawal
      srcCancellation: 121n, // 1sec public withdrawal
      srcPublicCancellation: 122n, // 1sec private cancellation
      dstWithdrawal: 10n, // 10sec finality lock for test
      dstPublicWithdrawal: 100n, // 100sec private withdrawal
      dstCancellation: 101n, // 1sec public withdrawal
    });
    timeLocks.setDeployedAt(BigInt(Math.floor(Date.now() / 1000))); // Current timestamp in seconds
    order.timelocks = timeLocks;
    return order;
  }
}

export class CreateOrderDto {
  makerPk: string;
  srcChainId: number;
  destChainId: number;
  makerAssetAddress: string;
  takerAssetAddress: string;
  makingAmount: number;
  takingAmount: number;
  makerAssetDecimals: number;
  takerAssetDecimals: number;
  makerEvmAddress: string;
  makerNearAccountId: string;
}
