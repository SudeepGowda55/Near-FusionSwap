export class OrderDto {
  orderHash: string;
  hashlock: string;
  maker: string;
  taker: string;
  token: string;
  amount: string;
  safetyDeposit: string;
  timelocks: string;
}

export class CreateOrderDto {
  makerPk: string;
  srcChainId: number;
  destChainId: number;
  makerAssetAddress: string;
  takerAssetAddress: string;
  makingAmount: number;
  takingAmount: number;
  makerAssetDecimals: number = 18;
  takerAssetDecimals: number = 18;
}
