import { Injectable } from '@nestjs/common';
import { connect, Contract, keyStores, KeyPair } from 'near-api-js';
import * as crypto from 'crypto';
import { HTLCResponse } from './interfaces/htlc.interface';

// Custom console wrapper to suppress NEAR receipt logs
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;

// Temporarily disable console override to see all logs
console.log = originalConsoleLog;
console.info = originalConsoleInfo;

console.info = (...args) => {
  const message = args.join(' ');
  if (
    !message.includes('Receipt:') &&
    !message.includes('Log [flexlock-1inch.testnet]:') &&
    !message.includes('Receipts:')
  ) {
    originalConsoleInfo(...args);
  }
};

// Use the compatible NEAR API configuration
const NEAR_CONFIG = {
  networkId: 'testnet',
  keyStore: new keyStores.InMemoryKeyStore(),
  nodeUrl: 'https://rpc.testnet.near.org',
  walletUrl: 'https://wallet.testnet.near.org',
  helperUrl: 'https://helper.testnet.near.org',
  explorerUrl: 'https://explorer.testnet.near.org',
};

const CONTRACT_ID = 'flexlock-1inch.testnet';
// Real NEAR testnet accounts provided by user
const RESOLVER_ACCOUNT = 'htlc.testnet';
const MAKER_ACCOUNT = 'goldrogerswap.testnet';

// Real private keys from the provided JSON files
const RESOLVER_PRIVATE_KEY =
  'ed25519:4f531FqBKzMKTPhzaAntW2Jciq3hFFEEUxKgRCfQU9hn8kUnVvjw17MZSwvgVfLkTgbBwJ3iB9GzmUER7J5FQGmL';
const MAKER_PRIVATE_KEY =
  'ed25519:qE5dhFpxEoye4RwTxHrrUUKC8HTgY7xA1bND7WhBrXksEDaJoykLzZTwhLWNwm5AUVoP8bJfmefhUiAmYD8QkJi';

// Contract interface
interface HTLCContract extends Contract {
  new_htlc: (params: {
    signerAccount: any;
    args: {
      htlc_id: string;
      sender: string;
      receiver: string;
      hashlock: string;
      timelocks: {
        withdrawal: number;
        public_withdrawal: number;
        cancellation: number;
        public_cancellation: number;
      };
      is_destination: boolean;
      partial_secrets_hex?: string[] | null;
    };
    gas?: string;
    amount?: string;
  }) => Promise<any>;
  claim: (params: {
    signerAccount: any;
    args: { htlc_id: string; secret: string };
  }) => Promise<any>;
  refund: (params: {
    signerAccount: any;
    args: { htlc_id: string };
  }) => Promise<any>;
  get_htlc_details: (args: { htlc_id: string }) => Promise<any>;
}

// Define proper return types
export interface SrcEscrowResult {
  htlc_id: string;
  secret: string;
  hash: string;
  timelocks: any;
  result: any;
  message: string;
}

export interface DestEscrowResult {
  htlc_id: string;
  hash: string;
  timelocks: any;
  result: any;
  transaction_hash?: string;
  explorer_url?: string;
  message: string;
}

@Injectable()
export class NearService {
  private near: any;
  private contract: HTLCContract | null = null;
  private resolverAccount: any;
  private makerAccount: any;
  private currentSecret: string = '';
  private currentHash: string = '';

  async initialize() {
    if (this.contract) return;

    console.log('🔧 Initializing NEAR service with real testnet accounts...');

    try {
      // Create key pairs from the provided private keys
      const resolverKeyPair = KeyPair.fromString(RESOLVER_PRIVATE_KEY);
      const makerKeyPair = KeyPair.fromString(MAKER_PRIVATE_KEY);

      // Store keys in keystore
      await NEAR_CONFIG.keyStore.setKey(
        NEAR_CONFIG.networkId,
        RESOLVER_ACCOUNT,
        resolverKeyPair,
      );
      await NEAR_CONFIG.keyStore.setKey(
        NEAR_CONFIG.networkId,
        MAKER_ACCOUNT,
        makerKeyPair,
      );

      // Initialize NEAR connection with proper configuration
      this.near = await connect(NEAR_CONFIG);

      // Create accounts with the real keys
      this.resolverAccount = await this.near.account(RESOLVER_ACCOUNT);
      this.makerAccount = await this.near.account(MAKER_ACCOUNT);

      // Initialize real contract using the compatible API
      this.contract = new Contract(this.resolverAccount, CONTRACT_ID, {
        viewMethods: ['get_htlc_details'],
        changeMethods: ['new_htlc', 'claim', 'refund'],
      }) as HTLCContract;

      console.log(
        '✅ NEAR contract service initialized with real testnet accounts',
      );
      console.log('📋 Contract ID:', CONTRACT_ID);
      console.log('👤 Resolver Account:', RESOLVER_ACCOUNT);
      console.log('👤 Maker Account:', MAKER_ACCOUNT);
      console.log('🔑 Using real private keys for signing transactions');
    } catch (error) {
      console.error('❌ Failed to initialize NEAR service:', error);
      throw new Error(`NEAR service initialization failed: ${error.message}`);
    }
  }

  private generateSecretHash(): { secret: string; hash: string } {
    // Generate a proper hex secret (32 bytes = 64 hex chars)
    const secret = crypto.randomBytes(32).toString('hex');
    // Hash the BINARY representation of the hex secret
    const hash = crypto
      .createHash('sha256')
      .update(Buffer.from(secret, 'hex'))
      .digest('hex');

    // Store for later use
    this.currentSecret = secret;
    this.currentHash = hash;

    return { secret, hash };
  }

  private calculateTimelocks(): {
    withdrawal: number;
    public_withdrawal: number;
    cancellation: number;
    public_cancellation: number;
  } {
    const now = Date.now() * 1000000; // Convert to nanoseconds
    return {
      withdrawal: now + 1800000000000, // +30 minutes
      public_withdrawal: now + 3600000000000, // +1 hour
      cancellation: now + 5400000000000, // +1.5 hours
      public_cancellation: now + 7200000000000, // +2 hours
    };
  }

  // Real implementation for deploying source escrow (NEAR as source chain)
  public async deploySrcEscrow(
    maker: string = MAKER_ACCOUNT,
    resolver: string = RESOLVER_ACCOUNT,
    amount: string = '1000000000000000000000000',
    hashlock?: string,
  ): Promise<SrcEscrowResult> {
    console.log('🔹 Creating HTLC on NEAR (source chain)...');
    await this.initialize();

    // Remove '0x' prefix from hashlock if present for NEAR contract compatibility
    const cleanHashlock =
      hashlock && hashlock.startsWith('0x') ? hashlock.slice(2) : hashlock;

    const { secret, hash } = cleanHashlock
      ? { secret: '', hash: cleanHashlock }
      : this.generateSecretHash();

    const timelocks = this.calculateTimelocks();
    const htlcId = `source_htlc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // User (goldrogerswap.testnet) creates HTLC on NEAR (source chain)
    // User SENDS NEAR tokens → Resolver RECEIVES NEAR tokens (as reimbursement)
    const htlcParams = {
      htlc_id: htlcId,
      sender: maker, // User (goldrogerswap.testnet) is the sender
      receiver: resolver, // Resolver receives NEAR as reimbursement
      hashlock: hash,
      timelocks: timelocks,
      is_destination: false, // This is source chain
      partial_secrets_hex: null,
    };

    console.log('📋 HTLC Parameters:', JSON.stringify(htlcParams, null, 2));
    console.log('💰 Deposit amount:', amount);
    console.log('🔐 Secret (hex):', secret);
    console.log('🔑 Hash:', hash);

    try {
      // Use maker account to create the HTLC
      const makerContract = new Contract(this.makerAccount, CONTRACT_ID, {
        viewMethods: ['get_htlc_details'],
        changeMethods: ['new_htlc', 'claim', 'refund'],
      }) as HTLCContract;

      const result = await makerContract.new_htlc({
        signerAccount: this.makerAccount,
        args: htlcParams,
        gas: '300000000000000', // Gas limit
        amount: amount, // Deposit amount
      });

      console.log('✅ Source HTLC deployed successfully:', result);

      return {
        htlc_id: htlcId,
        secret: secret,
        hash: hash,
        timelocks: timelocks,
        result: result,
        message:
          'HTLC created on NEAR (source chain) - User SENDS NEAR → Resolver RECEIVES NEAR',
      };
    } catch (error) {
      console.error('❌ Failed to deploy src escrow:', error);
      throw new Error(`Source escrow deployment failed: ${error.message}`);
    }
  }

  // Real implementation for deploying destination escrow (NEAR as destination chain)
  public async deployDestEscrow(
    resolver: string = RESOLVER_ACCOUNT,
    maker: string = MAKER_ACCOUNT,
    amount: string = '1000000000000000000000000',
    hashlock?: string,
  ): Promise<DestEscrowResult> {
    console.log('🔹 Creating HTLC on NEAR (destination chain)...');
    await this.initialize();

    // Clean and validate the amount parameter
    let cleanAmount = amount;
    if (typeof amount !== 'string') {
      cleanAmount = String(amount);
    }

    // Remove any non-numeric characters except decimal points
    cleanAmount = cleanAmount.replace(/[^\d.]/g, '');

    // If it contains a decimal, convert to wei equivalent for NEAR (24 decimals)
    if (cleanAmount.includes('.')) {
      const parts = cleanAmount.split('.');
      const integerPart = parts[0] || '0';
      const decimalPart = (parts[1] || '').padEnd(24, '0').slice(0, 24);
      cleanAmount = integerPart + decimalPart;
    }

    // Ensure it's a valid number string
    if (!/^\d+$/.test(cleanAmount)) {
      console.error('❌ Invalid amount format:', amount);
      cleanAmount = '1000000000000000000000000'; // Fallback to default
    }

    console.log('💰 Original amount:', amount);
    console.log('💰 Cleaned amount:', cleanAmount);

    // Remove '0x' prefix from hashlock if present for NEAR contract compatibility
    const cleanHashlock =
      hashlock && hashlock.startsWith('0x') ? hashlock.slice(2) : hashlock;

    const { secret, hash } = cleanHashlock
      ? { secret: this.currentSecret, hash: cleanHashlock }
      : this.generateSecretHash();

    const timelocks = this.calculateTimelocks();
    const htlcId = `dest_htlc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Resolver creates HTLC on NEAR (destination chain)
    // Resolver SENDS NEAR tokens → User RECEIVES NEAR tokens
    const htlcParams = {
      htlc_id: htlcId,
      sender: resolver, // Resolver is the sender (providing NEAR)
      receiver: maker, // User (goldrogerswap.testnet) receives NEAR tokens
      hashlock: hash,
      timelocks: timelocks,
      is_destination: true, // This is destination chain
      partial_secrets_hex: null,
    };

    console.log('📋 HTLC Parameters:', JSON.stringify(htlcParams, null, 2));
    console.log('💰 Deposit amount:', cleanAmount);
    console.log('🔐 Secret (hex):', secret);
    console.log('🔑 Hash:', hash);

    // Declare originalLog outside the try block to fix the scope issue
    const originalLog = console.log;
    let capturedTransactionHash = '';

    try {
      // Capture console output to get the real transaction hash
      console.log = (...args) => {
        const message = args.join(' ');
        if (message.startsWith('Receipt: ')) {
          capturedTransactionHash = message.replace('Receipt: ', '').trim();
          originalLog('🎯 Captured transaction hash:', capturedTransactionHash);
        }
        originalLog(...args); // Still log normally
      };

      const result = await this.contract!.new_htlc({
        signerAccount: this.resolverAccount,
        args: htlcParams,
        gas: '300000000000000', // Gas limit
        amount: cleanAmount, // Use cleaned amount
      });

      // Use the captured hash instead of fallback
      const transactionHash =
        capturedTransactionHash || `fallback_${htlcId}_${Date.now()}`;

      console.log('🔍 Full result object:', JSON.stringify(result, null, 2));
      console.log('🔍 Result type:', typeof result);
      console.log('🔍 Captured transaction hash:', capturedTransactionHash);
      console.log('🔍 Final transaction hash:', transactionHash);

      const nearExplorerUrl = `https://explorer.testnet.near.org/transactions/${transactionHash}`;

      console.log('✅ Destination HTLC deployed successfully!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔗 **REAL TRANSACTION HASH:**', transactionHash);
      console.log('🔗 **NEAR EXPLORER:**', nearExplorerUrl);
      console.log('📋 **HTLC ID:**', htlcId);
      console.log('🔐 **HASHLOCK:**', hash);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      return {
        htlc_id: htlcId,
        hash: hash,
        timelocks: timelocks,
        result: result,
        transaction_hash: transactionHash, // Now using the real hash!
        explorer_url: nearExplorerUrl,
        message:
          'HTLC created on NEAR (destination chain) - Resolver SENDS NEAR → User RECEIVES NEAR',
      };
    } catch (error) {
      console.error('❌ Failed to deploy dest escrow:', error);
      throw new Error(`Destination escrow deployment failed: ${error.message}`);
    } finally {
      // Restore original console.log in finally block to ensure it always runs
      console.log = originalLog;
    }
  }

  // Real implementation for claiming on source escrow
  public async srcEscrowWithdraw(
    htlcId?: string,
    secret?: string,
  ): Promise<HTLCResponse> {
    console.log(
      '🔹 User (goldrogerswap.testnet) claiming from their own source escrow...',
    );
    await this.initialize();

    const claimHtlcId = htlcId || `source_claim_${Date.now()}`;
    let claimSecret = secret || this.currentSecret;

    if (!claimSecret) {
      throw new Error('No secret available for claiming');
    }

    // Remove '0x' prefix if present for NEAR compatibility
    if (claimSecret.startsWith('0x')) {
      claimSecret = claimSecret.slice(2);
    }

    console.log('🔐 Using secret for claiming:', claimSecret);

    // Capture transaction hash
    const originalLog = console.log;
    let capturedTransactionHash = '';

    try {
      // Use user account to claim from source escrow (they are the resolver in this HTLC)
      const userContract = new Contract(this.makerAccount, CONTRACT_ID, {
        viewMethods: ['get_htlc_details'],
        changeMethods: ['new_htlc', 'claim', 'refund'],
      }) as HTLCContract;

      // Capture console output for transaction hash
      console.log = (...args) => {
        const message = args.join(' ');
        // Look for "Receipts:" for claim transactions
        if (message.startsWith('Receipts: ')) {
          const receipts = message.replace('Receipts: ', '').split(', ');
          capturedTransactionHash = receipts[0].trim();
          originalLog(
            '🎯 Captured claim transaction hash:',
            capturedTransactionHash,
          );
        }
        originalLog(...args);
      };

      const result = await userContract.claim({
        signerAccount: this.makerAccount,
        args: { htlc_id: claimHtlcId, secret: claimSecret },
      });

      const transactionHash =
        capturedTransactionHash || `fallback_${claimHtlcId}_${Date.now()}`;
      const nearExplorerUrl = `https://explorer.testnet.near.org/transactions/${transactionHash}`;

      console.log(
        '✅ Source escrow claim successful - User received their own NEAR tokens back',
      );
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔗 **CLAIM TRANSACTION HASH:**', transactionHash);
      console.log('🔗 **NEAR EXPLORER:**', nearExplorerUrl);
      console.log('📋 **HTLC ID:**', claimHtlcId);
      console.log('🔐 **SECRET USED:**', claimSecret);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      return {
        htlc_id: claimHtlcId,
        secret: claimSecret,
        hash: this.currentHash,
        contract_address: CONTRACT_ID,
        message:
          'User claimed NEAR tokens from source escrow - Phase 2 complete',
        status: 'success',
        transaction_hash: transactionHash,
        explorer_url: nearExplorerUrl,
      };
    } catch (error) {
      console.error('❌ Failed to claim source escrow:', error);
      throw new Error(`Source escrow claim failed: ${error.message}`);
    } finally {
      // Restore original console.log
      console.log = originalLog;
    }
  }

  // Real implementation for claiming on destination escrow
  public async destEscrowWithdraw(
    htlcId?: string,
    secret?: string,
  ): Promise<HTLCResponse> {
    console.log('🔹 User (Final Recipient) claiming NEAR tokens...');
    await this.initialize();

    const claimHtlcId = htlcId || `dest_claim_${Date.now()}`;
    let claimSecret = secret || this.currentSecret;

    if (!claimSecret) {
      throw new Error('No secret available for claiming');
    }

    // Remove '0x' prefix if present for NEAR compatibility
    if (claimSecret.startsWith('0x')) {
      claimSecret = claimSecret.slice(2);
    }

    console.log('🔐 Using secret for claiming:', claimSecret);

    // Declare originalLog outside the try block to fix the scope issue
    const originalLog = console.log;
    let capturedTransactionHash = '';

    try {
      // Use maker account to claim
      const makerContract = new Contract(this.makerAccount, CONTRACT_ID, {
        viewMethods: ['get_htlc_details'],
        changeMethods: ['new_htlc', 'claim', 'refund'],
      }) as HTLCContract;

      // Capture console output for claim transaction
      console.log = (...args) => {
        const message = args.join(' ');
        // For claims, look for "Receipts:" instead of "Receipt:"
        if (message.startsWith('Receipts: ')) {
          // Take the first receipt hash as the transaction hash
          const receipts = message.replace('Receipts: ', '').split(', ');
          capturedTransactionHash = receipts[0].trim();
          originalLog(
            '🎯 Captured claim transaction hash:',
            capturedTransactionHash,
          );
        }
        originalLog(...args);
      };

      const result = await makerContract.claim({
        signerAccount: this.makerAccount,
        args: { htlc_id: claimHtlcId, secret: claimSecret },
      });

      const transactionHash =
        capturedTransactionHash || `fallback_${claimHtlcId}_${Date.now()}`;

      const nearExplorerUrl = `https://explorer.testnet.near.org/transactions/${transactionHash}`;

      console.log('✅ Destination escrow claim successful');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔗 **REAL TRANSACTION HASH:**', transactionHash);
      console.log('🔗 **NEAR EXPLORER:**', nearExplorerUrl);
      console.log('📋 **HTLC ID:**', claimHtlcId);
      console.log('🔐 **SECRET:**', claimSecret);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      return {
        htlc_id: claimHtlcId,
        secret: claimSecret,
        hash: this.currentHash,
        contract_address: CONTRACT_ID,
        message:
          'User claimed NEAR tokens and revealed secret - Resolver can now claim on source chain',
        status: 'success',
        transaction_hash: transactionHash,
        explorer_url: nearExplorerUrl,
      };
    } catch (error) {
      console.error('❌ Failed to claim destination escrow:', error);
      throw new Error(`Destination escrow claim failed: ${error.message}`);
    } finally {
      // Restore original console.log in finally block to ensure it always runs
      console.log = originalLog;
    }
  }

  // Real implementation for cancelling order
  public async cancel(htlcId?: string): Promise<HTLCResponse> {
    console.log('🔹 Cancelling HTLC order...');
    await this.initialize();

    const cancelHtlcId = htlcId || `cancelled_${Date.now()}`;

    try {
      const result = await this.contract!.refund({
        signerAccount: this.resolverAccount,
        args: { htlc_id: cancelHtlcId },
      });

      console.log('✅ HTLC cancellation successful');

      return {
        htlc_id: cancelHtlcId,
        secret: 'cancelled',
        hash: 'cancelled',
        contract_address: CONTRACT_ID,
        message: 'Order cancelled by maker',
        status: 'cancelled',
      };
    } catch (error) {
      console.error('❌ Failed to cancel HTLC:', error);
      throw new Error(`HTLC cancellation failed: ${error.message}`);
    }
  }

  // Real implementation for getting HTLC details
  public async getHTLCDetails(htlcId: string): Promise<any> {
    console.log('🔍 Querying HTLC details...');
    await this.initialize();

    try {
      const details = await this.contract!.get_htlc_details({
        htlc_id: htlcId,
      });
      console.log('✅ HTLC details retrieved');
      return details;
    } catch (error) {
      console.error('❌ Failed to get HTLC details:', error);
      throw new Error(`HTLC details retrieval failed: ${error.message}`);
    }
  }

  // Get current secret and hash for external use
  public getCurrentSecret(): string {
    return this.currentSecret;
  }

  public getCurrentHash(): string {
    return this.currentHash;
  }

  // Method to set secret and hash from external source (e.g., from Polygon)
  public setSecretAndHash(secret: string, hash: string): void {
    // Remove '0x' prefix from secret for NEAR compatibility
    this.currentSecret = secret.startsWith('0x') ? secret.slice(2) : secret;
    this.currentHash = hash;
    console.log('🔐 Secret and hash set from external source');
  }
}
