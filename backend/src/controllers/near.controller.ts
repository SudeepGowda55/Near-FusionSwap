import { Request, Response } from 'express';
import { NearService } from '../services/near.service';

export class NearController {
  private nearService: NearService;

  constructor() {
    this.nearService = new NearService();
  }

  // Deploy source escrow (NEAR -> Other chain)
  public deploySrcEscrow = async (req: Request, res: Response) => {
    try {
      const { sender, receiver, amount, hashlock } = req.body;
      
      const result = await this.nearService.deploySrcEscrow(
        sender,
        receiver,
        amount,
        hashlock
      );
      
      res.json({
        success: true,
        data: result,
        message: 'Source escrow deployed on NEAR'
      });
    } catch (error) {
      console.error('❌ Deploy source escrow failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Deploy destination escrow (Other chain -> NEAR)
  public deployDestEscrow = async (req: Request, res: Response) => {
    try {
      const { sender, receiver, amount, hashlock } = req.body;
      
      const result = await this.nearService.deployDestEscrow(
        sender,
        receiver,
        amount,
        hashlock
      );
      
      res.json({
        success: true,
        data: result,
        message: 'Destination escrow deployed on NEAR'
      });
    } catch (error) {
      console.error('❌ Deploy destination escrow failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Withdraw from source escrow
  public srcEscrowWithdraw = async (req: Request, res: Response) => {
    try {
      const { htlc_id, secret, claimer } = req.body;
      
      const result = await this.nearService.srcEscrowWithdraw(
        htlc_id,
        secret,
        claimer
      );
      
      res.json({
        success: true,
        data: result,
        message: 'Funds withdrawn from source escrow'
      });
    } catch (error) {
      console.error('❌ Source escrow withdraw failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Withdraw from destination escrow
  public destEscrowWithdraw = async (req: Request, res: Response) => {
    try {
      const { htlc_id, secret, claimer } = req.body;
      
      const result = await this.nearService.destEscrowWithdraw(
        htlc_id,
        secret,
        claimer
      );
      
      res.json({
        success: true,
        data: result,
        message: 'Funds withdrawn from destination escrow'
      });
    } catch (error) {
      console.error('❌ Destination escrow withdraw failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Cancel/Refund HTLC
  public cancel = async (req: Request, res: Response) => {
    try {
      const { htlc_id } = req.body;
      
      const result = await this.nearService.cancel(htlc_id);
      
      res.json({
        success: true,
        data: result,
        message: 'Order cancelled and refunded'
      });
    } catch (error) {
      console.error('❌ Cancel/refund failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Get HTLC details
  public getHTLCDetails = async (req: Request, res: Response) => {
    try {
      const { htlc_id } = req.params;
      
      const result = await this.nearService.getHTLCDetails(htlc_id);
      
      res.json({
        success: true,
        data: result,
        message: 'HTLC details retrieved'
      });
    } catch (error) {
      console.error('❌ Get HTLC details failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}
