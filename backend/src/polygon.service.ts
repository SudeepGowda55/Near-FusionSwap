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
import * as Constants from './constants';
import 'dotenv/config';

const polygonResolverPk =
  process.env.POLYGON_RESOLVER_PRIVATE_KEY ||
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';

@Injectable()
export class PolygonService {
  chainId = config.chain.polygon.chainId;

  src: Chain;
  resolver: Wallet;
  contractFactory: EscrowFactory;
  srcTimestamp: bigint;

  public async initialize() {
    this.src = await this.initChain(config.chain.polygon);

    this.resolver = new Wallet(polygonResolverPk, this.src.provider);
    this.contractFactory = new EscrowFactory(
      this.src.provider,
      this.src.escrowFactory,
    );

    this.srcTimestamp = BigInt(
      (await this.src.provider.getBlock('latest'))!.timestamp,
    );
  }

  public async initChain(cnf: ChainConfig): Promise<{
    node?: any;
    provider: JsonRpcProvider;
    escrowFactory: string;
    resolver: string;
  }> {
    const { node, provider } = await getProvider(cnf);
    const deployer = new SignerWallet(cnf.ownerPrivateKey, provider);

    let escrowFactory: string;
    if (Constants.POLYGON_ESCROW_FACTORY) {
      escrowFactory = Constants.POLYGON_ESCROW_FACTORY;
    } else {
      // deploy EscrowFactory
      escrowFactory = await this.deploy(
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
    }

    let resolver: string;
    if (Constants.POLYGON_RESOLVER_CONTRACT_ADDRESS) {
      resolver = Constants.POLYGON_RESOLVER_CONTRACT_ADDRESS;
    } else {
      // deploy Resolver contract
      resolver = await this.deploy(
        resolverContract,
        [
          escrowFactory,
          cnf.limitOrderProtocol,
          computeAddress(polygonResolverPk), // white listed resolver
        ],
        provider,
        deployer,
      );
      console.log(
        `[${cnf.chainId}]`,
        `Resolver contract deployed to`,
        resolver,
      );
    }

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

    return srcEscrowEvent;
  }

  public async deployDestEscrow(
    orderData: OrderDto,
    hashLock: string,
  ): Promise<{
    newDstImmutables: Sdk.Immutables;
    newDstImmutablesComplement: Sdk.DstImmutablesComplement;
    dstDeployedAt: bigint;
    dstEscrowAddress: string;
  }> {
    // Transfer WETH from resolver wallet to resolver contract
    await this.resolver.transferToken(
      config.chain.polygon.tokens.WETH.address,
      this.src.resolver,
      parseEther('0.00001'),
    );

    // Transfer MATIC to resolver contract for gas
    await this.resolver.transfer(this.src.resolver, parseEther('0.01'));

    const resolverContractInstance = new Resolver('', this.src.resolver);

    await this.resolver.send(
      resolverContractInstance.approveToken(
        config.chain.polygon.tokens.WETH.address,
        this.src.escrowFactory,
        parseEther('999999'), // Large approval amount
        'dst',
      ),
    );

    // Build destination immutables from orderData input
    const newDstImmutables = Sdk.Immutables.new({
      orderHash: orderData.orderHash,
      hashLock: Sdk.HashLock.fromString(hashLock),
      maker: new Sdk.Address(orderData.maker),
      taker: new Sdk.Address(await this.resolver.getAddress()),
      token: new Sdk.Address(orderData.token),
      amount: parseEther(orderData.amount),
      safetyDeposit: parseEther('0.00001'),
      timeLocks: orderData.timelocks,
    });

    const newDstImmutablesComplement = Sdk.DstImmutablesComplement.new({
      maker: newDstImmutables.maker,
      amount: newDstImmutables.amount,
      token: newDstImmutables.token,
      safetyDeposit: newDstImmutables.safetyDeposit,
    });

    console.log(
      `[${this.chainId}]`,
      `Depositing ${newDstImmutables.amount} for order ${orderData.orderHash}`,
    );

    const {
      txHash: dstDepositHash,
      blockTimestamp: dstDeployedAt,
      blockHash: dstDeployBlock,
    } = await this.resolver.send(
      resolverContractInstance.deployDst(newDstImmutables),
    );
    console.log(
      `[${this.chainId}] Deployed Dst Escrow Contract in polygon with tx ${dstDepositHash}`,
    );

    // Get the actual deployed destination escrow address from the DstEscrowCreated event
    const dstEscrowAddress =
      await this.contractFactory.getDstDeployEvent(dstDeployBlock);
    console.log(
      `[${this.chainId}] Actual Dst Escrow Address: ${dstEscrowAddress}`,
    );

    return {
      newDstImmutables,
      newDstImmutablesComplement,
      dstDeployedAt,
      dstEscrowAddress, // Add the actual address to the return
    };
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
    dstImmutables: Sdk.Immutables,
    dstImmutablesComplement: Sdk.DstImmutablesComplement,
    secret: string,
    dstDeployedAt: bigint,
    dstEscrowAddress: string,
  ) {
    const resolverContract = new Resolver('', this.src.resolver);

    console.log(
      `[${this.chainId}]`,
      `Withdrawing funds for user from ${dstEscrowAddress}`,
    );

    const { txHash: dstWithdrawHash } = await this.resolver.send(
      resolverContract.withdraw(
        'dst',
        new Address(dstEscrowAddress),
        secret,
        dstImmutables.withDeployedAt(dstDeployedAt),
      ),
    );

    console.log(
      `[${this.chainId}]`,
      `Successfully withdrew funds for resolver from ${dstEscrowAddress} to ${this.src.resolver} in tx ${dstWithdrawHash}`,
    );

    return;
  }
}
