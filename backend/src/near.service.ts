import { Injectable } from '@nestjs/common';
import { connect, keyStores, KeyPair } from 'near-api-js';
import * as crypto from 'crypto';
import { HTLCResponse } from './interfaces/htlc.interface';

interface HTLCRequest {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  maker: string;
  resolver: string;
}

@Injectable()
export class NearService {
  private readonly CONTRACT_ID = 'flexlock-1inch.testnet';
  private readonly ALICE = 'flexlock-swap.testnet';
  private readonly RESOLVER = 'htlc.testnet';

  // Generate secret and hash like in the bash script
  private generateSecretHash(): { secret: string; hash: string } {
    // Generate a proper hex secret (32 bytes = 64 hex chars)
    const secret = crypto.randomBytes(32).toString('hex');
    // Hash the BINARY representation of the hex secret
    const hash = crypto
      .createHash('sha256')
      .update(Buffer.from(secret, 'hex'))
      .digest('hex');
    return { secret, hash };
  }

  // Calculate timelocks like in the bash script
  private calculateTimelocks(): {
    withdrawal: string;
    public_withdrawal: string;
    cancellation: string;
    public_cancellation: string;
  } {
    const now = Date.now() * 1000000; // Convert to nanoseconds
    const withdrawal = (now + 1800000000000).toString(); // +30 minutes
    const public_withdrawal = (now + 3600000000000).toString(); // +1 hour
    const cancellation = (now + 5400000000000).toString(); // +1.5 hours
    const public_cancellation = (now + 7200000000000).toString(); // +2 hours

    return {
      withdrawal,
      public_withdrawal,
      cancellation,
      public_cancellation,
    };
  }

  // Deploy source escrow (NEAR as source chain)
  public async deploySrcEscrow(
    maker: string = this.ALICE,
    resolver: string = this.RESOLVER,
    amount: string = '1000000000000000000000000',
  ): Promise<HTLCResponse> {
    console.log('🔹 Creating HTLC on NEAR (source chain)...');

    const { secret, hash } = this.generateSecretHash();
    const timelocks = this.calculateTimelocks();
    const htlcId = `source_htlc_${Date.now()}`;

    // Alice (Maker) creates HTLC on NEAR (source chain)
    // Alice SENDS NEAR tokens → Resolver RECEIVES NEAR tokens (as reimbursement)
    const htlcParams = {
      htlc_id: htlcId,
      sender: maker, // Alice (Maker) is the sender
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

    // In a real implementation, this would call the NEAR contract
    // near call $CONTRACT new_htlc '...' --accountId $ALICE --deposit 1

    return {
      htlc_id: htlcId,
      secret: secret,
      hash: hash,
      contract_address: this.CONTRACT_ID,
      message:
        'HTLC created on NEAR (source chain) - Alice SENDS NEAR → Resolver RECEIVES NEAR',
      status: 'success',
    };
  }

  // Deploy destination escrow (NEAR as destination chain)
  public async deployDestEscrow(
    resolver: string = this.RESOLVER,
    maker: string = this.ALICE,
    amount: string = '1000000000000000000000000',
  ): Promise<HTLCResponse> {
    console.log('🔹 Creating HTLC on NEAR (destination chain)...');

    const { secret, hash } = this.generateSecretHash();
    const timelocks = this.calculateTimelocks();
    const htlcId = `dest_htlc_${Date.now()}`;

    // Resolver creates HTLC on NEAR (destination chain)
    // Resolver SENDS NEAR tokens → Alice RECEIVES NEAR tokens
    const htlcParams = {
      htlc_id: htlcId,
      sender: resolver, // Resolver is the sender (providing NEAR)
      receiver: maker, // Alice (Maker) receives NEAR tokens
      hashlock: hash,
      timelocks: timelocks,
      is_destination: true, // This is destination chain
      partial_secrets_hex: null,
    };

    console.log('📋 HTLC Parameters:', JSON.stringify(htlcParams, null, 2));
    console.log('💰 Deposit amount:', amount);
    console.log('🔐 Secret (hex):', secret);
    console.log('🔑 Hash:', hash);

    // In a real implementation, this would call the NEAR contract
    // near call $CONTRACT new_htlc '...' --accountId $RESOLVER --deposit 1

    return {
      htlc_id: htlcId,
      secret: secret,
      hash: hash,
      contract_address: this.CONTRACT_ID,
      message:
        'HTLC created on NEAR (destination chain) - Resolver SENDS NEAR → Alice RECEIVES NEAR',
      status: 'success',
    };
  }

  // Claim on source escrow (Alice claims NEAR back as confirmation)
  public async srcEscrowWithdraw(
    htlcId?: string,
    secret?: string,
  ): Promise<HTLCResponse> {
    console.log(
      '🔹 Alice (Maker) claiming NEAR tokens (confirmation of completed swap)...',
    );

    // In a real implementation, this would call the NEAR contract
    // near call $CONTRACT claim '{"htlc_id": "'$HTLC_ID'", "secret": "'$SECRET'"}' --accountId $ALICE

    return {
      htlc_id: htlcId || `source_claim_${Date.now()}`,
      secret: secret || 'claimed_secret',
      hash: 'claimed_hash',
      contract_address: this.CONTRACT_ID,
      message:
        'Alice claimed NEAR tokens using secret - confirms resolver completed destination side',
      status: 'success',
    };
  }

  // Claim on destination escrow (Alice claims NEAR tokens)
  public async destEscrowWithdraw(
    htlcId?: string,
    secret?: string,
  ): Promise<HTLCResponse> {
    console.log('🔹 Alice (Final Recipient/Maker) claiming NEAR tokens...');

    // In a real implementation, this would call the NEAR contract
    // near call $CONTRACT claim '{"htlc_id": "'$HTLC_ID'", "secret": "'$SECRET'"}' --accountId $ALICE

    return {
      htlc_id: htlcId || `dest_claim_${Date.now()}`,
      secret: secret || 'claimed_secret',
      hash: 'claimed_hash',
      contract_address: this.CONTRACT_ID,
      message:
        'Alice claimed NEAR tokens and revealed secret - Resolver can now claim on source chain',
      status: 'success',
    };
  }

  // Cancel order
  public async cancel(htlcId?: string): Promise<HTLCResponse> {
    console.log('🔹 Cancelling HTLC order...');

    // In a real implementation, this would call the NEAR contract
    // near call $CONTRACT refund '{"htlc_id": "'$HTLC_ID'"}' --accountId $RESOLVER

    return {
      htlc_id: htlcId || `cancelled_${Date.now()}`,
      secret: 'cancelled',
      hash: 'cancelled',
      contract_address: this.CONTRACT_ID,
      message: 'Order cancelled by maker',
      status: 'cancelled',
    };
  }

  // Get HTLC details
  public async getHTLCDetails(htlcId: string): Promise<any> {
    console.log('🔍 Querying HTLC details...');

    // In a real implementation, this would call the NEAR contract
    // near view $CONTRACT get_htlc_details '{"htlc_id": "'$HTLC_ID'"}'

    return {
      htlc_id: htlcId,
      status: 'active',
      sender: this.RESOLVER,
      receiver: this.ALICE,
      amount: '1000000000000000000000000',
      is_destination: true,
      created_at: new Date().toISOString(),
    };
  }
}
