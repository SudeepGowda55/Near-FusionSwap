import { Injectable } from '@nestjs/common';

@Injectable()
export class NearService {
  public async deploySrcEscrow() {
    return 'Src Escrow Deployed on near testnet';
  }

  public async deployDestEscrow(): Promise<string> {
    // Implement the logic to deploy destination contract
    return 'Destination contract deployed on near testnet';
  }

  public async srcEscrowWithdraw() {
    return 'Funds withdrawn from Src Escrow contract';
  }

  public async destEscrowWithdraw() {
    return 'Funds withdrawn from Dest Escrow contract';
  }

  public async cancel() {
    return 'Order cancelled by maker';
  }
}
