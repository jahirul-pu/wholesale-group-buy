export interface PaymentIntent {
  amount: number;
  currency: string;           // 'BDT'
  transactionId: string;      // Our unique ID
  customerPhone: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
}

export interface PaymentResult {
  checkoutUrl: string;        // Redirect URL for the user
  gatewaySessionId?: string;  // Gateway's own session/payment ID
}

export interface VerificationResult {
  verified: boolean;
  amount: number;
  gatewayTransactionId: string;
  rawResponse: any;
}

export interface IPaymentAdapter {
  createPayment(payload: PaymentIntent): Promise<PaymentResult>;
  verifyPayment(transactionId: string): Promise<VerificationResult>;
}
