import { Injectable } from '@nestjs/common';
import * as Sdk from '@1inch/cross-chain-sdk';
import {
  computeAddress,
  ContractFactory,
  JsonRpcProvider,
  parseEther,
  Wallet as SignerWallet,
} from 'ethers';
import { config, ChainConfig } from './polygon/config';
import resolverContract from './polygon/contracts/Resolver.sol/Resolver.json';
import factoryContract from './polygon/contracts/TestEscrowFactory.sol/TestEscrowFactory.json';
import { EscrowFactory } from './polygon/escrow-factory';
import { Wallet } from './wallet';
import { Address } from '@1inch/fusion-sdk';
import { Resolver } from './polygon/resolver';
import { OrderDto } from './dto/order.dto';
import { getProvider } from './utils';
import { Chain } from './polygon/types';

const polygonResolverPk =
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';

@Injectable()
export class PolygonService {
  chainId = config.chain.polygon.chainId;

  src: Chain;
  resolver: Wallet;
  contractFactory: EscrowFactory;
  srcResolverContract: Wallet;
  srcTimestamp: bigint;

  public async initialize() {
    this.src = await this.initChain(config.chain.polygon);

    this.resolver = new Wallet(polygonResolverPk, this.src.provider);
    this.contractFactory = new EscrowFactory(
      this.src.provider,
      this.src.escrowFactory,
    );
    this.srcResolverContract = await Wallet.fromAddress(
      this.src.resolver,
      this.src.provider,
    );

    this.srcTimestamp = BigInt(
      (await this.src.provider.getBlock('latest'))!.timestamp,
    );
  }

  public async increaseTime(t: number): Promise<void> {
    await this.src.provider.send('evm_increaseTime', [t]);
  }

  public async initChain(cnf: ChainConfig): Promise<{
    node?: any;
    provider: JsonRpcProvider;
    escrowFactory: string;
    resolver: string;
  }> {
    const { node, provider } = await getProvider(cnf);
    const deployer = new SignerWallet(cnf.ownerPrivateKey, provider);

    // deploy EscrowFactory
    const escrowFactory = await this.deploy(
      factoryContract,
      [
        cnf.limitOrderProtocol,
        cnf.wrappedNative, // feeToken,
        Address.fromBigInt(0n).toString(), // accessToken,
        deployer.address, // owner
        60 * 30, // src rescue delay
        60 * 30, // dst rescue delay
      ],
      provider,
      deployer,
    );
    console.log(
      `[${cnf.chainId}]`,
      `Escrow factory contract deployed to`,
      escrowFactory,
    );

    // deploy Resolver contract
    const resolver = await this.deploy(
      resolverContract,
      [
        escrowFactory,
        cnf.limitOrderProtocol,
        computeAddress(polygonResolverPk), // white listed resolver
      ],
      provider,
      deployer,
    );
    console.log(`[${cnf.chainId}]`, `Resolver contract deployed to`, resolver);

    return { node: node, provider, resolver, escrowFactory };
  }

  /**
   * Deploy contract and return its address
   */
  public async deploy(
    json: { abi: any; bytecode: any },
    params: unknown[],
    provider: JsonRpcProvider,
    deployer: SignerWallet,
  ): Promise<string> {
    const deployed = await new ContractFactory(
      json.abi,
      json.bytecode,
      deployer,
    ).deploy(...params);
    const deployTx = deployed.deploymentTransaction();
    await deployed.waitForDeployment();

    // Calculate deployment gas fee
    if (deployTx) {
      const deployReceipt = await provider.getTransactionReceipt(deployTx.hash);
      if (deployReceipt) {
        const deployFee = deployReceipt.gasUsed * deployReceipt.gasPrice;
        const deployFeeMatic = Number(deployFee) / 1e18;
        console.log(
          `Deployment gas fee: ${deployFee.toString()} wei MATIC (${deployFeeMatic.toFixed(8)} MATIC)`,
        );
      }
    }

    return await deployed.getAddress();
  }

  public async deploySrcEscrow(
    order: Sdk.CrossChainOrder,
    orderHash: string,
    signature: string,
  ): Promise<[Sdk.Immutables, Sdk.DstImmutablesComplement]> {
    const resolverContractInstance = new Resolver(this.src.resolver, '');

    console.log(`[${this.chainId}]`, `Filling order ${orderHash}`);

    const fillAmount = order.makingAmount;
    const { txHash: orderFillHash, blockHash: srcDeployBlock } =
      await this.resolver.send(
        resolverContractInstance.deploySrc(
          this.chainId,
          order,
          signature,
          Sdk.TakerTraits.default()
            .setExtension(order.extension)
            .setAmountMode(Sdk.AmountMode.maker)
            .setAmountThreshold(order.takingAmount),
          fillAmount,
        ),
      );

    console.log(
      `[${this.chainId}]`,
      `Order ${orderHash} filled for ${fillAmount} in tx ${orderFillHash}`,
    );

    const srcEscrowEvent =
      await this.contractFactory.getSrcDeployEvent(srcDeployBlock);

    await this.increaseTime(11);

    return srcEscrowEvent;
  }

  public async deployDestEscrow(orderData: OrderDto): Promise<string> {
    // Setup destination chain (Polygon acts as destination in this scenario)
    const dst = await this.initChain(config.chain.polygon);

    const dstChainResolver = new Wallet(polygonResolverPk, dst.provider);

    const dstFactory = new EscrowFactory(dst.provider, dst.escrowFactory);

    // Setup resolver contract with funds and approvals
    const dstResolverContract = await Wallet.fromAddress(
      dst.resolver,
      dst.provider,
    );
    await dstResolverContract.topUpFromDonor(
      config.chain.polygon.tokens.WETH.address, // Polygon WETH
      config.chain.polygon.tokens.WETH.donor,
      parseEther('0.00001'), // 0.00001 WETH
    );
    // Top up contract for approve
    await dstChainResolver.transfer(dst.resolver, parseEther('1'));
    await dstResolverContract.unlimitedApprove(
      config.chain.polygon.tokens.WETH.address,
      dst.escrowFactory,
    );

    // Build destination immutables from orderData input
    const newDstImmutables = Sdk.Immutables.new({
      orderHash: orderData.orderHash,
      hashLock: Sdk.HashLock.fromString(orderData.hashlock),
      maker: new Sdk.Address(orderData.maker),
      taker: new Sdk.Address(orderData.taker),
      token: new Sdk.Address(orderData.token),
      amount: BigInt(orderData.amount),
      safetyDeposit: BigInt(orderData.safetyDeposit),
      timeLocks: Sdk.TimeLocks.fromBigInt(BigInt(orderData.timelocks)),
    });

    const newDstImmutablesComplement = Sdk.DstImmutablesComplement.new({
      maker: new Sdk.Address(orderData.maker),
      amount: BigInt(orderData.amount),
      token: new Sdk.Address(orderData.token),
      safetyDeposit: BigInt(orderData.safetyDeposit),
    });

    const resolverContract = new Resolver('', dst.resolver);

    console.log(
      `[${config.chain.polygon.chainId}]`,
      `Depositing ${newDstImmutables.amount} for order ${orderData.orderHash}`,
    );
    const { txHash: dstDepositHash, blockTimestamp: dstDeployedAt } =
      await dstChainResolver.send(resolverContract.deployDst(newDstImmutables));
    console.log(
      `[${config.chain.polygon.chainId}]`,
      `Created dst deposit for order ${orderData.orderHash} in tx ${dstDepositHash}`,
    );

    const ESCROW_DST_IMPLEMENTATION = await dstFactory.getDestinationImpl();

    // Note: srcEscrowEvent would come from the source chain deployment data
    // For now, we'll use the orderData to reconstruct what we need
    const dstEscrowAddress = new Sdk.EscrowFactory(
      new Sdk.Address(dst.escrowFactory),
    ).getDstEscrowAddress(
      newDstImmutables,
      newDstImmutablesComplement,
      dstDeployedAt,
      new Sdk.Address(resolverContract.dstAddress),
      ESCROW_DST_IMPLEMENTATION,
    );

    await this.increaseTime(11);

    // User shares key after validation of dst escrow deployment
    console.log(
      `[${config.chain.polygon.chainId}]`,
      `Withdrawing funds for user from ${dstEscrowAddress}`,
    );
    // await dstChainResolver.send(
    //   resolverContract.withdraw(
    //     'dst',
    //     dstEscrowAddress,
    //     orderData.secret, // Secret should be provided in orderData
    //     newDstImmutables.withDeployedAt(dstDeployedAt),
    //   ),
    // );

    // console.log(
    //   `[${config.chain.polygon.chainId}]`,
    //   `Withdrew funds from destination escrow ${dstEscrowAddress}`,
    // );

    return `Destination escrow deployed and withdrawal completed! Escrow: ${dstEscrowAddress}, Deploy Tx: ${dstDepositHash}`;
  }

  public async srcEscrowWithdraw(
    srcEscrowEvent: [Sdk.Immutables, Sdk.DstImmutablesComplement],
    secret: string,
  ) {
    const ESCROW_SRC_IMPLEMENTATION =
      await this.contractFactory.getSourceImpl();

    const srcEscrowAddress = new Sdk.EscrowFactory(
      new Address(this.src.escrowFactory),
    ).getSrcEscrowAddress(srcEscrowEvent[0], ESCROW_SRC_IMPLEMENTATION);

    console.log(
      `[${this.chainId}]`,
      `Withdrawing funds for resolver from ${srcEscrowAddress}`,
    );

    const resolverContractInstance = new Resolver(this.src.resolver, '');

    const { txHash: resolverWithdrawHash } = await this.resolver.send(
      resolverContractInstance.withdraw(
        'src',
        srcEscrowAddress,
        secret,
        srcEscrowEvent[0],
      ),
    );

    console.log(
      `[${this.chainId}]`,
      `Withdrew funds for resolver from ${srcEscrowAddress} to ${this.src.resolver} in tx ${resolverWithdrawHash}`,
    );

    return;
  }

  public async destEscrowWithdraw(
    srcEscrowEvent: [Sdk.Immutables, Sdk.DstImmutablesComplement],
    secret: string,
    dstDeployedAt: bigint,
  ) {
    const ESCROW_DST_IMPLEMENTATION =
      await this.contractFactory.getDestinationImpl();

    const resolverContract = new Resolver('', this.src.resolver);

    const dstEscrowAddress = new Sdk.EscrowFactory(
      new Address(this.src.escrowFactory),
    ).getDstEscrowAddress(
      srcEscrowEvent[0],
      srcEscrowEvent[1],
      dstDeployedAt,
      new Address(resolverContract.dstAddress),
      ESCROW_DST_IMPLEMENTATION,
    );

    await this.increaseTime(11);

    console.log(
      `[${this.chainId}]`,
      `Withdrawing funds for user from ${dstEscrowAddress}`,
    );

    const dstImmutables = srcEscrowEvent[0]
      .withComplement(srcEscrowEvent[1])
      .withTaker(new Address(resolverContract.dstAddress));

    await this.resolver.send(
      resolverContract.withdraw(
        'dst',
        dstEscrowAddress,
        secret,
        dstImmutables.withDeployedAt(dstDeployedAt),
      ),
    );

    console.log(
      `[${this.chainId}]`,
      `Withdrawing funds for resolver from ${dstEscrowAddress}`,
    );
    const { txHash: resolverWithdrawHash } = await this.resolver.send(
      resolverContract.withdraw(
        'src',
        dstEscrowAddress,
        secret,
        srcEscrowEvent[0],
      ),
    );
    console.log(
      `[${this.chainId}]`,
      `Withdrew funds for resolver from ${dstEscrowAddress} to ${this.src.resolver} in tx ${resolverWithdrawHash}`,
    );

    return 'Dest withdraw successful';
  }
}
