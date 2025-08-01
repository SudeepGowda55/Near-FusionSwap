import { Injectable } from '@nestjs/common';

@Injectable()
export class OrderService {
  public async createOrder() {
    return 'order created';
  }

  public async getOrderSecret() {
    return 'secret';
  }
}
