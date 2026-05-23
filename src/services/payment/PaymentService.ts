import { IPaymentAdapter } from '../../interfaces/IPaymentAdapter.js';
import { BkashAdapter } from './BkashAdapter.js';
import { SslCommerzAdapter } from './SslCommerzAdapter.js';

export class PaymentService {
  /**
   * Instantiates and returns the correct class implementing IPaymentAdapter
   */
  static getAdapter(gateway: 'BKASH' | 'SSLCOMMERZ'): IPaymentAdapter {
    switch (gateway) {
      case 'BKASH':
        return new BkashAdapter();
      case 'SSLCOMMERZ':
        return new SslCommerzAdapter();
      default:
        throw new Error(`Unsupported payment gateway: ${gateway}`);
    }
  }
}
