import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { DispatchService } from '../services/courier/DispatchService.js';
import { Prisma, Courier, DeliveryStatus } from '@prisma/client';

export async function dispatchCampaignOrders(req: Request, res: Response) {
  const campaignId = req.params.id as string;
  const courierType = (req.body.courier || 'PATHAO') as Courier;

  try {
    // 1. Fetch Campaign and active tiers
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        tiers: { orderBy: { targetVolume: 'asc' } },
      },
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    // 2. Count active pledges for calculating campaign final active price drops
    const activePledgeCount = await prisma.pledge.count({
      where: {
        campaignId,
        status: { in: ['PLEDGED', 'PENDING_PAYMENT', 'CONFIRMED'] },
      },
    });

    let campaignActivePrice = campaign.basePrice;
    for (const tier of campaign.tiers) {
      if (tier.isUnlocked || activePledgeCount >= tier.targetVolume) {
        campaignActivePrice = tier.unlockedPrice;
      }
    }

    // 3. Fetch all CONFIRMED pledges for the campaign
    const confirmedPledges = await prisma.pledge.findMany({
      where: {
        campaignId,
        status: 'CONFIRMED',
      },
      include: {
        user: true,
        delivery: true,
      },
    });

    if (confirmedPledges.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No confirmed pledges to dispatch for this campaign',
        dispatches: [],
      });
    }

    console.log(`📦 [Dispatch] Auto-dispatching ${confirmedPledges.length} confirmed orders to ${courierType}...`);

    const dispatches: any[] = [];
    const adapter = DispatchService.getAdapter(courierType);

    // 4. Iterate and dispatch each order externally (non-blocking outside transactional loops)
    for (const pledge of confirmedPledges) {
      const recipientPhone = pledge.user.phoneNumber;

      // Check if delivery already exists for this pledge (pre-guard before making external API call)
      if (pledge.delivery) {
        console.log(`⚠️ Delivery already exists for pledge ${pledge.id}. Skipping dispatch.`);
        dispatches.push({
          pledgeId: pledge.id,
          userPhone: recipientPhone,
          trackingId: pledge.delivery.trackingId,
          codAmount: Number(pledge.delivery.codAmount),
          status: 'SKIPPED',
          message: 'Delivery already exists',
        });
        continue;
      }

      // COD Amount = FinalPrice - TokenAdvancePaid
      const finalPrice = pledge.finalPrice || campaignActivePrice;
      const codAmountDecimal = new Prisma.Decimal(finalPrice).sub(pledge.tokenAdvancePaid);
      const codAmount = Math.max(0, Number(codAmountDecimal));

      // Generate recipient details based on database profiles (with fallbacks)
      const recipientName = `Customer (${recipientPhone.substring(recipientPhone.length - 4)})`;
      const deliveryAddress = 'Savar Delivery Hub Area, Dhaka, Bangladesh';

      const standardParcel = {
        customerName: recipientName,
        customerPhone: recipientPhone,
        deliveryAddress,
        codAmount,
        weight: 1.5, // 1.5kg default keyboard weight
      };

      try {
        // Dispatch order externally
        const result = await adapter.createParcel(standardParcel);

        // 5. Database write wrapped inside a single-order transaction
        await prisma.$transaction(async (tx) => {
          // Check if delivery already exists for this pledge (unique constraint guard)
          const existingDelivery = await tx.delivery.findUnique({
            where: { pledgeId: pledge.id },
          });

          if (existingDelivery) {
            console.log(`⚠️ Delivery already exists for pledge ${pledge.id}. Skipping.`);
            return;
          }

          // Create the Delivery tracking record
          await tx.delivery.create({
            data: {
              pledgeId: pledge.id,
              courier: courierType,
              trackingId: result.trackingId,
              status: DeliveryStatus.PENDING, // Maps to PENDING DeliveryStatus
              codAmount: codAmountDecimal,
            },
          });
        });

        dispatches.push({
          pledgeId: pledge.id,
          userPhone: recipientPhone,
          trackingId: result.trackingId,
          codAmount,
          status: 'SUCCESS',
        });
      } catch (dispatchError) {
        console.error(`❌ Failed to dispatch pledge ${pledge.id}:`, dispatchError);
        dispatches.push({
          pledgeId: pledge.id,
          userPhone: recipientPhone,
          status: 'FAILED',
          error: (dispatchError as Error).message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Processed order dispatch run to ${courierType}`,
      data: {
        totalConfirmed: confirmedPledges.length,
        dispatchedCount: dispatches.filter((d) => d.status === 'SUCCESS').length,
        skippedCount: dispatches.filter((d) => d.status === 'SKIPPED').length,
        failedCount: dispatches.filter((d) => d.status === 'FAILED').length,
        details: dispatches,
      },
    });

  } catch (err) {
    console.error('Error executing dispatch runner:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during order dispatch runner execution',
    });
  }
}
