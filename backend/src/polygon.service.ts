import { Injectable } from '@nestjs/common';
import * as Sdk from '@1inch/cross-chain-sdk';
import { uint8ArrayToHex, UINT_40_MAX } from '@1inch/byte-utils';
import {
  computeAddress,
  ContractFactory,
  JsonRpcProvider,
  MaxUint256,
  parseEther,
  parseUnits,
  randomBytes,
  Wallet as SignerWallet,
} from 'ethers';
import { config, ChainConfig } from './polygon/config';
import resolverContract from './polygon/contracts/Resolver.sol/Resolver.json';
import factoryContract from './polygon/contracts/TestEscrowFactory.sol/TestEscrowFactory.json';
import assert from 'node:assert';
import { EscrowFactory } from './polygon/escrow-factory';
import { Wallet } from './wallet';
import { Address } from '@1inch/fusion-sdk';
import { Resolver } from './resolver';

const userPk = '';
const resolverPk = '';

type Chain = {
  node?: any | undefined;
  provider: JsonRpcProvider;
  escrowFactory: string;
  resolver: string;
};

@Injectable()
export class PolygonService {
  srcChainId = config.chain.polygon.chainId;
  dstChainId = config.chain.destination.chainId;

  src: Chain;
  srcChainUser: Wallet;
  srcChainResolver: Wallet;
  srcFactory: EscrowFactory;
  srcResolverContract: Wallet;
  srcTimestamp: bigint;

  async initialize() {
    this.src = await this.initChain(config.chain.polygon);

    this.srcChainUser = new Wallet(userPk, this.src.provider);
    this.srcChainResolver = new Wallet(resolverPk, this.src.provider);

    this.srcFactory = new EscrowFactory(
      this.src.provider,
      this.src.escrowFactory,
    );

    await this.srcChainUser.approveToken(
      config.chain.polygon.tokens.WETH.address,
      config.chain.polygon.limitOrderProtocol,
      MaxUint256,
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
    const { node, provider } = await this.getProvider(cnf);
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
        computeAddress(resolverPk), // resolver as owner of contract
      ],
      provider,
      deployer,
    );
    console.log(`[${cnf.chainId}]`, `Resolver contract deployed to`, resolver);

    return { node: node, provider, resolver, escrowFactory };
  }

  public async getProvider(
    cnf: ChainConfig,
  ): Promise<{ node?: any; provider: JsonRpcProvider }> {
    if (!cnf.createFork) {
      return {
        provider: new JsonRpcProvider(cnf.url, cnf.chainId, {
          cacheTimeout: -1,
          staticNetwork: true,
        }),
      };
    }

    // Dynamic import for ES modules with TypeScript bypass
    const prool = await eval('import("prool")');
    const proolInstances = await eval('import("prool/instances")');
    const { createServer } = prool;
    const { anvil } = proolInstances;

    const node = createServer({
      instance: anvil({ forkUrl: cnf.url, chainId: cnf.chainId }),
      limit: 1,
    });
    await node.start();

    const address = node.address();
    assert(address);

    const provider = new JsonRpcProvider(
      `http://[${address.address}]:${address.port}/1`,
      cnf.chainId,
      {
        cacheTimeout: -1,
        staticNetwork: true,
      },
    );

    return {
      provider,
      node,
    };
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

  public async deploySrcEscrow(): Promise<string> {
    // Ensure initialization is complete
    if (!this.src) {
      await this.initialize();
    }

    // User creates order
    const secret = uint8ArrayToHex(randomBytes(32)); // note: use crypto secure random number in real world
    const order = Sdk.CrossChainOrder.new(
      new Sdk.Address(this.src.escrowFactory),
      {
        salt: Sdk.randBigInt(1000n),
        maker: new Sdk.Address(await this.srcChainUser.getAddress()),
        makingAmount: parseEther('0.00001'), // WETH in Polygon (18 decimals)
        takingAmount: parseUnits('0.001', 6), // USDC in BSC (6 decimals)
        makerAsset: new Sdk.Address(config.chain.polygon.tokens.WETH.address),
        takerAsset: new Sdk.Address(
          config.chain.destination.tokens.USDC.address,
        ),
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
        srcChainId: this.srcChainId,
        dstChainId: this.dstChainId,
        srcSafetyDeposit: parseEther('0.00001'),
        dstSafetyDeposit: parseEther('0.00001'),
      },
      {
        auction: new Sdk.AuctionDetails({
          initialRateBump: 0,
          points: [],
          duration: 120n,
          startTime: this.srcTimestamp,
        }),
        whitelist: [
          {
            address: new Sdk.Address(this.src.resolver),
            allowFrom: 0n,
          },
        ],
        resolvingStartTime: 0n,
      },
      {
        nonce: Sdk.randBigInt(UINT_40_MAX),
        allowMultipleFills: false,
      },
    );

    const signature = await this.srcChainUser.signOrder(this.srcChainId, order);
    const orderHash = order.getOrderHash(this.srcChainId);

    console.log('Order created successfully:', order.build());

    const resolverContractInstance = new Resolver(
      this.src.resolver,
      this.src.resolver,
    );

    console.log(`[${this.srcChainId}]`, `Filling order ${orderHash}`);

    const fillAmount = order.makingAmount;
    const { txHash: orderFillHash, blockHash: srcDeployBlock } =
      await this.srcChainResolver.send(
        resolverContractInstance.deploySrc(
          this.srcChainId,
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
      `[${this.srcChainId}]`,
      `Order ${orderHash} filled for ${fillAmount} in tx ${orderFillHash}`,
    );

    // Calculate Polygon deploySrc gas fee
    const fillReceipt =
      await this.src.provider.getTransactionReceipt(orderFillHash);
    if (fillReceipt) {
      const fillFee = fillReceipt.gasUsed * fillReceipt.gasPrice;
      const fillFeeMatic = Number(fillFee) / 1e18;
      console.log(
        `[${this.srcChainId}] Polygon deploySrc gas fee: ${fillFee.toString()} wei MATIC (${fillFeeMatic.toFixed(8)} MATIC)`,
      );
    }

    const srcEscrowEvent =
      await this.srcFactory.getSrcDeployEvent(srcDeployBlock);

    const ESCROW_SRC_IMPLEMENTATION = await this.srcFactory.getSourceImpl();
    // const ESCROW_DST_IMPLEMENTATION = await dstFactory.getDestinationImpl()

    const srcEscrowAddress = new Sdk.EscrowFactory(
      new Address(this.src.escrowFactory),
    ).getSrcEscrowAddress(srcEscrowEvent[0], ESCROW_SRC_IMPLEMENTATION);

    await this.increaseTime(11);

    console.log(
      `[${this.srcChainId}]`,
      `Withdrawing funds for resolver from ${srcEscrowAddress}`,
    );
    const { txHash: resolverWithdrawHash } = await this.srcChainResolver.send(
      resolverContractInstance.withdraw(
        'src',
        srcEscrowAddress,
        secret,
        srcEscrowEvent[0],
      ),
    );
    console.log(
      `[${this.srcChainId}]`,
      `Withdrew funds for resolver from ${srcEscrowAddress} to ${this.src.resolver} in tx ${resolverWithdrawHash}`,
    );

    // Calculate Polygon resolver withdrawal gas fee
    const withdrawReceipt =
      await this.src.provider.getTransactionReceipt(resolverWithdrawHash);
    if (withdrawReceipt) {
      const withdrawFee = withdrawReceipt.gasUsed * withdrawReceipt.gasPrice;
      const withdrawFeeMatic = Number(withdrawFee) / 1e18;
      console.log(
        `[${this.srcChainId}] Polygon withdrawSrc gas fee: ${withdrawFee.toString()} wei MATIC (${withdrawFeeMatic.toFixed(8)} MATIC)`,
      );
    }
    return 'Hello World!';
  }

  public async deployDestEscrow(): Promise<string> {
    // Ensure initialization is complete
    if (!this.src) {
      await this.initialize();
    }

    // Setup destination chain (Polygon acts as destination in this scenario)
    const dst = await this.initChain(config.chain.polygon);

    const dstChainUser = new Wallet(userPk, dst.provider);
    const dstChainResolver = new Wallet(resolverPk, dst.provider);

    const srcFactory = new EscrowFactory(
      this.src.provider,
      this.src.escrowFactory,
    );
    const dstFactory = new EscrowFactory(dst.provider, dst.escrowFactory);

    // Create a cross-chain order
    const secret = uint8ArrayToHex(randomBytes(32));
    const order = Sdk.CrossChainOrder.new(
      new Sdk.Address(this.src.escrowFactory),
      {
        salt: Sdk.randBigInt(1000n),
        maker: new Sdk.Address(await this.srcChainUser.getAddress()),
        makingAmount: parseUnits('0.001', 6), // USDC in source
        takingAmount: parseEther('0.00001'), // WETH in destination
        makerAsset: new Sdk.Address(
          config.chain.destination.tokens.USDC.address,
        ),
        takerAsset: new Sdk.Address(config.chain.polygon.tokens.WETH.address),
      },
      {
        hashLock: Sdk.HashLock.forSingleFill(secret),
        timeLocks: Sdk.TimeLocks.new({
          srcWithdrawal: 10n,
          srcPublicWithdrawal: 120n,
          srcCancellation: 121n,
          srcPublicCancellation: 122n,
          dstWithdrawal: 10n,
          dstPublicWithdrawal: 100n,
          dstCancellation: 101n,
        }),
        srcChainId: config.chain.destination.chainId,
        dstChainId: config.chain.polygon.chainId,
        srcSafetyDeposit: parseEther('0.00001'),
        dstSafetyDeposit: parseEther('0.00001'),
      },
      {
        auction: new Sdk.AuctionDetails({
          initialRateBump: 0,
          points: [],
          duration: 120n,
          startTime: this.srcTimestamp,
        }),
        whitelist: [
          {
            address: new Sdk.Address(this.src.resolver),
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

    const signature = await this.srcChainUser.signOrder(
      config.chain.destination.chainId,
      order,
    );
    const orderHash = order.getOrderHash(config.chain.destination.chainId);

    const resolverContract = new Resolver(this.src.resolver, dst.resolver);

    // Source side execution (this would normally happen on the actual source chain)
    const fillAmount = order.makingAmount;
    const { txHash: orderFillHash, blockHash: srcDeployBlock } =
      await this.srcChainResolver.send(
        resolverContract.deploySrc(
          config.chain.destination.chainId,
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
      `[${config.chain.destination.chainId}]`,
      `Order ${orderHash} filled for ${fillAmount} in tx ${orderFillHash}`,
    );

    const srcEscrowEvent = await srcFactory.getSrcDeployEvent(srcDeployBlock);

    const dstImmutables = srcEscrowEvent[0]
      .withComplement(srcEscrowEvent[1])
      .withTaker(new Sdk.Address(resolverContract.dstAddress));

    console.log(
      `[${config.chain.polygon.chainId}]`,
      `Depositing ${dstImmutables.amount} for order ${orderHash}`,
    );
    const { txHash: dstDepositHash, blockTimestamp: dstDeployedAt } =
      await dstChainResolver.send(resolverContract.deployDst(dstImmutables));
    console.log(
      `[${config.chain.polygon.chainId}]`,
      `Created dst deposit for order ${orderHash} in tx ${dstDepositHash}`,
    );

    const ESCROW_SRC_IMPLEMENTATION = await srcFactory.getSourceImpl();
    const ESCROW_DST_IMPLEMENTATION = await dstFactory.getDestinationImpl();

    const srcEscrowAddress = new Sdk.EscrowFactory(
      new Sdk.Address(this.src.escrowFactory),
    ).getSrcEscrowAddress(srcEscrowEvent[0], ESCROW_SRC_IMPLEMENTATION);

    const dstEscrowAddress = new Sdk.EscrowFactory(
      new Sdk.Address(dst.escrowFactory),
    ).getDstEscrowAddress(
      srcEscrowEvent[0],
      srcEscrowEvent[1],
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
    await dstChainResolver.send(
      resolverContract.withdraw(
        'dst',
        dstEscrowAddress,
        secret,
        dstImmutables.withDeployedAt(dstDeployedAt),
      ),
    );

    console.log(
      `[${config.chain.polygon.chainId}]`,
      `Withdrew funds from destination escrow ${dstEscrowAddress}`,
    );

    return `Destination escrow deployed and withdrawal completed! Escrow: ${dstEscrowAddress}, Deploy Tx: ${dstDepositHash}`;
  }

  public async srcEscrowWithdraw() {
    return 'Src withdraw successful';
  }

  public async destEscrowWithdraw() {
    return 'Dest withdraw successful';
  }
}
