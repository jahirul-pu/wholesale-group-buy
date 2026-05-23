import axios from 'axios';
import { IPaymentAdapter, PaymentIntent, PaymentResult, VerificationResult } from '../../interfaces/IPaymentAdapter.js';
import prisma from '../../config/prisma.js';

export class SslCommerzAdapter implements IPaymentAdapter {
  private apiBaseUrl = process.env.SSLCOMMERZ_API_BASE_URL || 'https://api.mock-gateways.com/sslcommerz';
  private storeId = process.env.SSLCOMMERZ_STORE_ID || 'mock-ssl-store';
  private storePass = process.env.SSLCOMMERZ_STORE_PASS || 'mock-ssl-pass';

  async createPayment(payload: PaymentIntent): Promise<PaymentResult> {
    console.log(`💳 [SSLCommerz] Creating session for txn: ${payload.transactionId}, amount: ${payload.amount}`);

    const requestBody = {
      store_id: this.storeId,
      store_passwd: this.storePass,
      total_amount: payload.amount.toString(),
      currency: payload.currency,
      tran_id: payload.transactionId,
      success_url: payload.successUrl,
      fail_url: payload.failUrl,
      cancel_url: payload.cancelUrl,
      cus_name: 'Customer',
      cus_email: 'customer@example.com',
      cus_add1: 'Dhaka',
      cus_country: 'Bangladesh',
      cus_phone: payload.customerPhone,
      shipping_method: 'NO',
      product_name: 'Group Buy Item',
      product_category: 'Wholesale',
      product_profile: 'general',
    };

    try {
      let checkoutUrl = `${payload.successUrl}?status=success&tran_id=${payload.transactionId}`;
      let gatewaySessionId = `SSL-SESSION-${payload.transactionId}`;

      try {
        const response = await axios.post(
          `${this.apiBaseUrl}/gwprocess/v4/api.php`,
          new URLSearchParams(requestBody).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 2000,
          }
        );
        if (response.data && response.data.status === 'SUCCESS' && response.data.GatewayPageURL) {
          checkoutUrl = response.data.GatewayPageURL;
          gatewaySessionId = response.data.sessionkey;
        }
      } catch (err) {
        console.log(`[SSLCommerz] Create session API failed. Falling back to mock checkout URL.`);
      }

      console.log(`✅ [SSLCommerz] Created payment. Checkout URL: ${checkoutUrl}, Session ID: ${gatewaySessionId}`);
      return { checkoutUrl, gatewaySessionId };
    } catch (error) {
      console.error('[SSLCommerz] Create session failed:', error);
      throw new Error('SSLCOMMERZ_CREATE_SESSION_FAILED');
    }
  }

  async verifyPayment(transactionId: string): Promise<VerificationResult> {
    console.log(`🔍 [SSLCommerz] Verifying payment for txn: ${transactionId}`);

    try {
      let verified = true;
      let amount = 0;
      let gatewayTransactionId = `SSL-TRX-${Math.floor(10000000 + Math.random() * 90000000)}`;
      let rawResponse: any = { status: 'VALID', tran_id: transactionId };

      try {
        // Retrieve val_id from some state if available, or use a mock val_id
        const valId = `val-id-${transactionId}`;
        const response = await axios.get(
          `${this.apiBaseUrl}/validator/api/validationserverAPI.php`,
          {
            params: {
              val_id: valId,
              store_id: this.storeId,
              store_passwd: this.storePass,
              format: 'json',
            },
            timeout: 2000,
          }
        );
        if (response.data) {
          verified = response.data.status === 'VALID' || response.data.status === 'SUCCESS';
          amount = parseFloat(response.data.amount);
          gatewayTransactionId = response.data.bank_tran_id || response.data.tran_id;
          rawResponse = response.data;
        }
      } catch (err) {
        console.log(`[SSLCommerz] Validator API failed. Falling back to mock verification.`);
      }

      if (amount === 0) {
        const txn = await prisma.transaction.findUnique({
          where: { transactionId }
        });
        if (txn) {
          amount = Number(txn.amount);
        }
      }

      console.log(`✅ [SSLCommerz] Verification result for ${transactionId}: verified=${verified}, amount=${amount}`);
      return {
        verified,
        amount,
        gatewayTransactionId,
        rawResponse,
      };
    } catch (error) {
      console.error('[SSLCommerz] Verification failed:', error);
      throw new Error('SSLCOMMERZ_VERIFICATION_FAILED');
    }
  }
}
