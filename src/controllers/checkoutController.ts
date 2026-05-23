import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { PaymentService } from '../services/payment/PaymentService.js';
import { broadcastPaymentConfirmed } from '../services/socketService.js';
import { Prisma } from '@prisma/client';

/**
 * Initiates checkout for a pledge by creating a pending transaction and returning a checkout URL
 */
export async function initiateCheckout(req: Request, res: Response) {
  const { pledgeId, paymentType, gateway } = req.body;

  if (!pledgeId || !paymentType || !gateway) {
    return res.status(400).json({
      success: false,
      message: 'pledgeId, paymentType, and gateway are required in request body',
    });
  }

  if (paymentType !== 'TOKEN_ADVANCE' && paymentType !== 'FULL_PAYMENT') {
    return res.status(400).json({
      success: false,
      message: 'Invalid paymentType. Must be TOKEN_ADVANCE or FULL_PAYMENT',
    });
  }

  if (gateway !== 'BKASH' && gateway !== 'SSLCOMMERZ') {
    return res.status(400).json({
      success: false,
      message: 'Invalid gateway. Must be BKASH or SSLCOMMERZ',
    });
  }

  try {
    // 1. Fetch pledge details including user
    const pledge = await prisma.pledge.findUnique({
      where: { id: pledgeId },
      include: { user: true },
    });

    if (!pledge) {
      return res.status(404).json({
        success: false,
        message: 'Pledge not found',
      });
    }

    if (pledge.status !== 'PENDING_PAYMENT') {
      return res.status(400).json({
        success: false,
        message: `Pledge is in ${pledge.status} state. Can only initiate payment for PENDING_PAYMENT status.`,
      });
    }

    // 2. Calculate amount
    // TOKEN_ADVANCE = 50% of lockedPrice (rounded up)
    // FULL_PAYMENT = 100% of lockedPrice
    let amount: number;
    if (paymentType === 'TOKEN_ADVANCE') {
      amount = Math.ceil(Number(pledge.lockedPrice) / 2);
    } else {
      amount = Number(pledge.lockedPrice);
    }

    // 3. Generate unique transactionId (format: TXN-{timestamp}-{random})
    const transactionId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 4. Create Transaction record with status PENDING
    await prisma.transaction.create({
      data: {
        pledgeId,
        transactionId,
        gateway,
        paymentType,
        amount,
        status: 'PENDING',
      },
    });

    // 5. Build payment adapter options/urls
    const successUrl = `${process.env.PAYMENT_CALLBACK_BASE_URL || 'http://localhost:3000'}/api/webhooks/payment?status=success&tran_id=${transactionId}`;
    const failUrl = `${process.env.PAYMENT_CALLBACK_BASE_URL || 'http://localhost:3000'}/api/webhooks/payment?status=fail&tran_id=${transactionId}`;
    const cancelUrl = `${process.env.PAYMENT_CALLBACK_BASE_URL || 'http://localhost:3000'}/api/webhooks/payment?status=cancel&tran_id=${transactionId}`;

    const adapter = PaymentService.getAdapter(gateway);
    const paymentResult = await adapter.createPayment({
      amount,
      currency: 'BDT',
      transactionId,
      customerPhone: pledge.user.phoneNumber,
      successUrl,
      failUrl,
      cancelUrl,
    });

    // 6. Return checkoutUrl and transactionId to client
    return res.status(200).json({
      success: true,
      message: 'Checkout initiated successfully',
      data: {
        checkoutUrl: paymentResult.checkoutUrl,
        transactionId,
        amount,
        gateway,
      },
    });
  } catch (error) {
    console.error('Error initiating checkout:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error initiating checkout',
    });
  }
}

/**
 * Handle IPN Webhooks and redirects from payment gateways (bKash, SSLCommerz)
 */
export async function handlePaymentWebhook(req: Request, res: Response) {
  console.log('📬 [Webhook] Payment update received:', { query: req.query, body: req.body });

  // Extract transactionId from multiple potential sources
  let transactionId = (req.body.tran_id || req.query.tran_id || req.body.transactionId || req.query.transactionId) as string;
  const paymentID = (req.body.paymentID || req.query.paymentID) as string;

  // Fallback parsers for mock payloads
  if (!transactionId && paymentID) {
    if (paymentID.startsWith('payment-id-TXN-')) {
      transactionId = paymentID.replace('payment-id-', '');
    } else if (paymentID.startsWith('BKASH-PAY-TXN-')) {
      transactionId = paymentID.replace('BKASH-PAY-', '');
    }
  }

  if (!transactionId) {
    return res.status(400).json({
      success: false,
      message: 'Could not extract transaction ID from request parameters or body',
    });
  }

  try {
    // 1. Fetch transaction record
    const transaction = await prisma.transaction.findUnique({
      where: { transactionId },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: `Transaction record ${transactionId} not found`,
      });
    }

    // 2. Idempotency Check: if already success, return success immediately
    if (transaction.status === 'SUCCESS') {
      console.log(`ℹ️ [Webhook] Transaction ${transactionId} was already marked SUCCESS. Idempotency protected.`);
      
      if (req.method === 'GET') {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        return res.redirect(`${frontendUrl}/profile?payment=success&txn=${transactionId}`);
      }
      return res.status(200).json({
        success: true,
        message: 'Payment already verified and processed successfully',
      });
    }

    // Handle user canceling or failing before verification call
    const statusParam = (req.body.status || req.query.status) as string;
    if (statusParam === 'fail' || statusParam === 'cancel') {
      const failStatus = statusParam === 'cancel' ? 'CANCELLED' : 'FAILED';
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: failStatus },
      });
      console.log(`❌ [Webhook] Payment transaction ${transactionId} failed or canceled by user.`);

      if (req.method === 'GET') {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        return res.redirect(`${frontendUrl}/profile?payment=failed&reason=${statusParam}`);
      }
      return res.status(400).json({
        success: false,
        message: `Payment failed or canceled with status: ${statusParam}`,
      });
    }

    // 3. Verify payment details with the gateway
    const adapter = PaymentService.getAdapter(transaction.gateway);
    const verifyResult = await adapter.verifyPayment(transactionId);

    if (!verifyResult.verified) {
      console.log(`❌ [Webhook] Gateway verification failed for txn ${transactionId}`);
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'FAILED',
          gatewayResponse: verifyResult.rawResponse || {},
        },
      });

      if (req.method === 'GET') {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        return res.redirect(`${frontendUrl}/profile?payment=failed&reason=verification_failed`);
      }
      return res.status(400).json({
        success: false,
        message: 'Gateway validation failed',
      });
    }

    // 4. Use Prisma transaction to atomically update database state
    const result = await prisma.$transaction(async (tx) => {
      // Recheck status inside locked transaction
      const currentTxn = await tx.transaction.findUnique({
        where: { id: transaction.id },
      });

      if (!currentTxn) {
        throw new Error('TRANSACTION_NOT_FOUND');
      }

      if (currentTxn.status === 'SUCCESS') {
        return { alreadySuccess: true, pledge: null };
      }

      // Update Transaction status to SUCCESS
      const updatedTxn = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'SUCCESS',
          gatewayResponse: verifyResult.rawResponse || {},
        },
      });

      // Update Pledge: mark as CONFIRMED, calculate amountPaid and codBalance
      const pledge = await tx.pledge.findUnique({
        where: { id: transaction.pledgeId },
      });

      if (!pledge) {
        throw new Error('PLEDGE_NOT_FOUND');
      }

      const verifiedAmount = new Prisma.Decimal(verifyResult.amount);
      const newAmountPaid = new Prisma.Decimal(pledge.amountPaid).add(verifiedAmount);
      const newCodBalance = new Prisma.Decimal(pledge.lockedPrice).sub(newAmountPaid);

      const updatedPledge = await tx.pledge.update({
        where: { id: pledge.id },
        data: {
          status: 'CONFIRMED',
          checkoutWindowExpiresAt: null,
          amountPaid: newAmountPaid,
          codBalance: newCodBalance,
        },
      });

      return {
        alreadySuccess: false,
        pledge: updatedPledge,
      };
    });

    if (result.alreadySuccess) {
      if (req.method === 'GET') {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        return res.redirect(`${frontendUrl}/profile?payment=success&txn=${transactionId}`);
      }
      return res.status(200).json({
        success: true,
        message: 'Payment already processed successfully',
      });
    }

    // 5. Broadcast Socket.io confirmed payment event
    if (result.pledge) {
      broadcastPaymentConfirmed(result.pledge.id, {
        userId: result.pledge.userId,
        campaignId: result.pledge.campaignId,
        amountPaid: Number(result.pledge.amountPaid),
        codBalance: Number(result.pledge.codBalance),
      });
    }

    console.log(`✅ [Webhook] Payment transaction ${transactionId} processed successfully!`);

    if (req.method === 'GET') {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(`${frontendUrl}/profile?payment=success&txn=${transactionId}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment confirmed successfully',
      data: {
        pledgeId: result.pledge?.id,
        amountPaid: Number(result.pledge?.amountPaid),
        codBalance: Number(result.pledge?.codBalance),
      },
    });
  } catch (error) {
    console.error('Error handling payment webhook:', error);
    
    if (req.method === 'GET') {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(`${frontendUrl}/profile?payment=error&message=webhook_error`);
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error processing payment webhook',
    });
  }
}
