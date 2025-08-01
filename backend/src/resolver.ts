import { Interface, Signature, TransactionRequest } from 'ethers';
import * as Sdk from '@1inch/cross-chain-sdk';
import { Address } from '@1inch/fusion-sdk';
import Contract from './polygon/contracts/Resolver.sol/Resolver.json';

export class Resolver {
  private readonly iface = new Interface(Contract.abi);

  constructor(
    public readonly srcAddress: string,
    public readonly dstAddress: string,
  ) {}

  public deploySrc(
    chainId: number,
    order: Sdk.CrossChainOrder,
    signature: string,
    takerTraits: Sdk.TakerTraits,
    amount: bigint,
    hashLock = order.escrowExtension.hashLockInfo,
  ): TransactionRequest {
    const { r, yParityAndS: vs } = Signature.from(signature);
    const { args, trait } = takerTraits.encode();
    const immutables = order.toSrcImmutables(
      chainId,
      new Address(this.srcAddress),
      amount,
      hashLock,
    );

    return {
      to: this.srcAddress,
      data: this.iface.encodeFunctionData('deploySrc', [
        immutables.build(),
        order.build(),
        r,
        vs,
        amount,
        trait,
        args,
      ]),
      value: order.escrowExtension.srcSafetyDeposit,
    };
  }

  public deployDst(
    /**
     * Immutables from SrcEscrowCreated event with complement applied
     */
    immutables: Sdk.Immutables,
  ): TransactionRequest {
    // Create a temporary immutable with deployed timestamp to get the time locks
    const deployedAt = BigInt(Math.floor(Date.now() / 1000));
    const tempImmutable = immutables.withDeployedAt(deployedAt);

    return {
      to: this.dstAddress,
      data: this.iface.encodeFunctionData('deployDst', [
        immutables.build(),
        immutables.timeLocks.toSrcTimeLocks(deployedAt).privateCancellation,
      ]),
      value: immutables.safetyDeposit,
    };
  }

  public withdraw(
    side: 'src' | 'dst',
    escrow: Address,
    secret: string,
    immutables: Sdk.Immutables,
  ): TransactionRequest {
    return {
      to: side === 'src' ? this.srcAddress : this.dstAddress,
      data: this.iface.encodeFunctionData('withdraw', [
        escrow.toString(),
        secret,
        immutables.build(),
      ]),
    };
  }

  public cancel(
    side: 'src' | 'dst',
    escrow: Address,
    immutables: Sdk.Immutables,
  ): TransactionRequest {
    return {
      to: side === 'src' ? this.srcAddress : this.dstAddress,
      data: this.iface.encodeFunctionData('cancel', [
        escrow.toString(),
        immutables.build(),
      ]),
    };
  }
}
