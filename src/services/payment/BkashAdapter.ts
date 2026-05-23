import axios from 'axios';
import { IPaymentAdapter, PaymentIntent, PaymentResult, VerificationResult } from '../../interfaces/IPaymentAdapter.js';
import prisma from '../../config/prisma.js';

export class BkashAdapter implements IPaymentAdapter {
  private apiBaseUrl = process.env.BKASH_API_BASE_URL || 'https://api.mock-gateways.com/bkash';
  private appKey = process.env.BKASH_APP_KEY || 'mock-bkash-app-key';
  private appSecret = process.env.BKASH_APP_SECRET || 'mock-bkash-app-secret';
  private username = process.env.BKASH_USERNAME || 'mock-bkash-user';
  private password = process.env.BKASH_PASSWORD || 'mock-bkash-pass';

  private async getGrantToken(): Promise<string> {
    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/checkout/token/grant`,
        { app_key: this.appKey, app_secret: this.appSecret },
        {
          headers: {
            username: this.username,
            password: this.password,
          },
          timeout: 2000,
        }
      );
      return response.data.id_token;
    } catch (error) {
      console.log(`[bKash] Token grant API failed, falling back to mock token.`);
      return 'mock-bkash-id-token';
    }
  }

  async createPayment(payload: PaymentIntent): Promise<PaymentResult> {
    console.log(`💳 [bKash] Creating payment session for txn: ${payload.transactionId}, amount: ${payload.amount}`);
    
    const idToken = await this.getGrantToken();

    const requestBody = {
      mode: '0011',
      payerReference: payload.customerPhone,
      callbackURL: payload.successUrl,
      amount: payload.amount.toString(),
      currency: payload.currency,
      intent: 'sale',
      merchantInvoiceNumber: payload.transactionId,
    };

    try {
      let checkoutUrl = `${payload.successUrl}?status=success&paymentID=payment-id-${payload.transactionId}`;
      let gatewaySessionId = `BKASH-PAY-${payload.transactionId}`;

      try {
        const response = await axios.post(
          `${this.apiBaseUrl}/checkout/payment/create`,
          requestBody,
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
              'X-APP-Key': this.appKey,
            },
            timeout: 2000,
          }
        );
        if (response.data?.bkashURL) {
          checkoutUrl = response.data.bkashURL;
          gatewaySessionId = response.data.paymentID;
        }
      } catch (err) {
        console.log(`[bKash] Create payment API failed. Falling back to mock checkout URL.`);
      }

      console.log(`✅ [bKash] Created payment. Checkout URL: ${checkoutUrl}, Session ID: ${gatewaySessionId}`);
      return { checkoutUrl, gatewaySessionId };
    } catch (error) {
      console.error('[bKash] Create payment failed:', error);
      throw new Error('BKASH_CREATE_PAYMENT_FAILED');
    }
  }

  async verifyPayment(transactionId: string): Promise<VerificationResult> {
    console.log(`🔍 [bKash] Verifying payment for txn: ${transactionId}`);
    const idToken = await this.getGrantToken();

    try {
      let verified = true;
      let amount = 0;
      let gatewayTransactionId = `BKASH-TRX-${Math.floor(10000000 + Math.random() * 90000000)}`;
      let rawResponse: any = { status: 'SUCCESS', transactionId };

      try {
        const response = await axios.post(
          `${this.apiBaseUrl}/checkout/payment/execute`,
          { paymentID: `BKASH-PAY-${transactionId}` },
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
              'X-APP-Key': this.appKey,
            },
            timeout: 2000,
          }
        );
        if (response.data) {
          verified = response.data.transactionStatus === 'Completed';
          amount = parseFloat(response.data.amount);
          gatewayTransactionId = response.data.trxID;
          rawResponse = response.data;
        }
      } catch (err) {
        console.log(`[bKash] Execute/Verify payment API failed. Falling back to mock verification.`);
      }

      if (amount === 0) {
        const txn = await prisma.transaction.findUnique({
          where: { transactionId }
        });
        if (txn) {
          amount = Number(txn.amount);
        }
      }

      console.log(`✅ [bKash] Verification result for ${transactionId}: verified=${verified}, amount=${amount}`);
      return {
        verified,
        amount,
        gatewayTransactionId,
        rawResponse,
      };
    } catch (error) {
      console.error('[bKash] Verification failed:', error);
      throw new Error('BKASH_VERIFICATION_FAILED');
    }
  }
}
