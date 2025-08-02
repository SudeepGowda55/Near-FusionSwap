import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { HTLCResponse } from './interfaces/htlc.interface';

@Injectable()
export class PolygonService {
  private initialized = false;
  private readonly CONTRACT_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
  private readonly ALICE = 'flexlock-swap.testnet';
  private readonly RESOLVER = 'htlc.testnet';

  public async initialize() {
    this.initialized = true;
    console.log('✅ Polygon service initialized (simulated)');
  }

  // Generate secret and hash like in the bash script
  private generateSecretHash(): { secret: string; hash: string } {
    // Generate a proper hex secret (32 bytes = 64 hex chars)
    const secret = crypto.randomBytes(32).toString('hex');
    // Hash the BINARY representation of the hex secret
    const hash = crypto.createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex');
    return { secret, hash };
  }

  // Deploy source escrow (Polygon as source chain)
  public async deploySrcEscrow(): Promise<HTLCResponse> {
    if (!this.initialized) await this.initialize();
    
    console.log('🔹 Creating HTLC on Polygon (source chain)...');
    
    const { secret, hash } = this.generateSecretHash();
    const htlcId = `polygon_src_${Date.now()}`;

    // Alice (Maker) creates HTLC on Polygon (source chain)
    // Alice SENDS USDC tokens → Resolver RECEIVES USDC tokens (as reimbursement)
    const htlcParams = {
      htlc_id: htlcId,
      sender: this.ALICE, // Alice (Maker) is the sender
      receiver: this.RESOLVER, // Resolver receives USDC as reimbursement
      hashlock: hash,
      amount: '1000000000000000000', // 1 WETH in wei
      is_destination: false // This is source chain
    };

    console.log('📋 HTLC Parameters:', JSON.stringify(htlcParams, null, 2));
    console.log('🔐 Secret (hex):', secret);
    console.log('🔑 Hash:', hash);

    // In a real implementation, this would call the Polygon contract
    // contract.new_htlc(htlcParams)
    
    return {
      htlc_id: htlcId,
      secret: secret,
      hash: hash,
      contract_address: this.CONTRACT_ADDRESS,
      message: 'HTLC created on Polygon (source chain) - Alice SENDS USDC → Resolver RECEIVES USDC',
      status: 'success'
    };
  }

  // Deploy destination escrow (Polygon as destination chain)
  public async deployDestEscrow(): Promise<HTLCResponse> {
    if (!this.initialized) await this.initialize();
    
    console.log('🔹 Creating HTLC on Polygon (destination chain)...');
    
    const { secret, hash } = this.generateSecretHash();
    const htlcId = `polygon_dest_${Date.now()}`;

    // Resolver creates HTLC on Polygon (destination chain)
    // Resolver SENDS USDC tokens → Alice RECEIVES USDC tokens
    const htlcParams = {
      htlc_id: htlcId,
      sender: this.RESOLVER, // Resolver is the sender (providing USDC)
      receiver: this.ALICE, // Alice (Maker) receives USDC tokens
      hashlock: hash,
      amount: '1000000000000000000', // 1 WETH in wei
      is_destination: true // This is destination chain
    };

    console.log('📋 HTLC Parameters:', JSON.stringify(htlcParams, null, 2));
    console.log('🔐 Secret (hex):', secret);
    console.log('🔑 Hash:', hash);

    // In a real implementation, this would call the Polygon contract
    // contract.new_htlc(htlcParams)

    return {
      htlc_id: htlcId,
      secret: secret,
      hash: hash,
      contract_address: this.CONTRACT_ADDRESS,
      message: 'HTLC created on Polygon (destination chain) - Resolver SENDS USDC → Alice RECEIVES USDC',
      status: 'success'
    };
  }

  // Claim on source escrow (Alice claims USDC back as confirmation)
  public async srcEscrowWithdraw(htlcId?: string, secret?: string): Promise<HTLCResponse> {
    console.log('🔹 Alice (Maker) claiming USDC tokens (confirmation of completed swap)...');
    
    // In a real implementation, this would call the Polygon contract
    // contract.claim(htlcId, secret)

    return {
      htlc_id: htlcId || `polygon_src_claim_${Date.now()}`,
      secret: secret || 'claimed_secret',
      hash: 'claimed_hash',
      contract_address: this.CONTRACT_ADDRESS,
      message: 'Alice claimed USDC tokens using secret - confirms resolver completed destination side',
      status: 'success'
    };
  }

  // Claim on destination escrow (Alice claims USDC tokens)
  public async destEscrowWithdraw(htlcId?: string, secret?: string): Promise<HTLCResponse> {
    console.log('🔹 Alice (Final Recipient/Maker) claiming USDC tokens...');
    
    // In a real implementation, this would call the Polygon contract
    // contract.claim(htlcId, secret)

    return {
      htlc_id: htlcId || `polygon_dest_claim_${Date.now()}`,
      secret: secret || 'claimed_secret',
      hash: 'claimed_hash',
      contract_address: this.CONTRACT_ADDRESS,
      message: 'Alice claimed USDC tokens and revealed secret - Resolver can now claim on source chain',
      status: 'success'
    };
  }

  // Cancel order
  public async cancel(htlcId?: string): Promise<HTLCResponse> {
    console.log('🔹 Cancelling HTLC order on Polygon...');
    
    // In a real implementation, this would call the Polygon contract
    // contract.refund(htlcId)

    return {
      htlc_id: htlcId || `polygon_cancelled_${Date.now()}`,
      secret: 'cancelled',
      hash: 'cancelled',
      contract_address: this.CONTRACT_ADDRESS,
      message: 'Order cancelled by maker on Polygon',
      status: 'cancelled'
    };
  }
}
