import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import crypto from 'crypto';
import { DeliveryStatus, PledgeStatus, OrphanStatus } from '@prisma/client';

const WEBHOOK_SECRET = process.env.COURIER_WEBHOOK_SECRET || 'super-secret-webhook-key';

function verifySignature(req: Request, secret: string): boolean {
  const signature = req.headers['x-courier-signature'] as string;
  if (!signature) return false;

  // Simple token authentication fallback (e.g. signature exactly matches the secret)
  if (signature === secret) return true;

  try {
    const computedHash = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    const signatureBuffer = Buffer.from(signature);
    const computedBuffer = Buffer.from(computedHash);

    if (signatureBuffer.length !== computedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(signatureBuffer, computedBuffer);
  } catch (e) {
    return false;
  }
}

export async function handleCourierWebhook(req: Request, res: Response) {
  // 1. Basic security validation
  if (!verifySignature(req, WEBHOOK_SECRET)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid courier signature header',
    });
  }

  const { trackingId, status } = req.body;

  if (!trackingId || !status) {
    return res.status(400).json({
      success: false,
      message: 'Bad Request: trackingId and status are required',
    });
  }

  // 2. Filter specifically for failed/bounced delivery updates
  const isFailed = status === 'RETURNED' || status === 'FAILED_DELIVERY';
  if (!isFailed) {
    console.log(`ℹ️ [Webhook] Received non-failed status update: ${status} for tracking ID ${trackingId}. Skipping penalty logic.`);
    return res.status(200).json({
      success: true,
      message: `Webhook received. Status '${status}' is not a failed delivery state. No action taken.`,
    });
  }

  try {
    // 3. Find the Delivery record by tracking ID
    const delivery = await prisma.delivery.findFirst({
      where: { trackingId },
      include: {
        pledge: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: `Delivery record not found for tracking ID: ${trackingId}`,
      });
    }

    const { pledge } = delivery;
    if (!pledge) {
      return res.status(404).json({
        success: false,
        message: `Linked pledge not found for delivery ID: ${delivery.id}`,
      });
    }

    // 4. Implement the Penalty Transaction
    const result = await prisma.$transaction(async (tx) => {
      // a) Update the Delivery status to RETURNED
      const updatedDelivery = await tx.delivery.update({
        where: { id: delivery.id },
        data: { status: DeliveryStatus.RETURNED },
      });

      // b) Update the linked Pledge status to REJECTED_AT_DOOR
      const updatedPledge = await tx.pledge.update({
        where: { id: pledge.id },
        data: { status: PledgeStatus.REJECTED_AT_DOOR },
      });

      // c) Decrement the associated User's currentTrust score by exactly 50 points.
      // Ensure the database/logic constrains this from falling below 0.
      const user = await tx.user.findUnique({
        where: { id: pledge.userId },
      });

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const newTrust = Math.max(0, user.currentTrust - 50);
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { currentTrust: newTrust },
      });

      // d) Insert a row into the TrustLog table explicitly detailing the penalty:
      // "COD Rejected at Door - Courier Return"
      const trustLog = await tx.trustLog.create({
        data: {
          userId: user.id,
          deltaScore: -50,
          newTotalScore: newTrust,
          reason: 'COD Rejected at Door - Courier Return',
        },
      });

      // e) Initialize an OrphanInventory record with status: PENDING_INSPECTION,
      // linked to the campaign and original pledge.
      const existingOrphan = await tx.orphanInventory.findUnique({
        where: { pledgeId: pledge.id },
      });

      let orphan = null;
      if (!existingOrphan) {
        orphan = await tx.orphanInventory.create({
          data: {
            campaignId: pledge.campaignId,
            pledgeId: pledge.id,
            status: OrphanStatus.PENDING_INSPECTION,
          },
        });
      } else {
        orphan = existingOrphan;
      }

      return {
        delivery: updatedDelivery,
        pledge: updatedPledge,
        user: updatedUser,
        trustLog,
        orphan,
      };
    });

    console.log(`✅ [Webhook] Failed delivery processed successfully for tracking ID ${trackingId}.`);
    return res.status(200).json({
      success: true,
      message: 'Failed delivery processed and user penalized successfully',
      data: result,
    });
  } catch (err) {
    console.error('Error handling courier webhook:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing webhook update',
    });
  }
}
