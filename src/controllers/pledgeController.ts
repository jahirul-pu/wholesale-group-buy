import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { broadcastCampaignUpdate } from '../services/socketService.js';
import { Prisma } from '@prisma/client';

export async function createPledge(req: Request, res: Response) {
  const campaignId = req.params.id as string;
  const userId = req.body.userId as string;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'userId is required in request body',
    });
  }

  try {
    // Execute the database modifications inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify user exists
      const user = await tx.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // 2. Lock the Campaign row using SELECT FOR UPDATE to prevent race conditions
      // in counting volume and unlocking tiers.
      const campaignLock = await tx.$queryRaw<any[]>`
        SELECT 1 FROM "Campaign" WHERE id = ${campaignId}::uuid FOR UPDATE
      `;
      if (!campaignLock || campaignLock.length === 0) {
        throw new Error('CAMPAIGN_NOT_FOUND');
      }

      // 3. Retrieve Campaign details with Tiers
      const campaign = (await tx.campaign.findUnique({
        where: { id: campaignId },
        include: {
          tiers: {
            orderBy: { targetVolume: 'asc' },
          },
        },
      })) as any;

      if (!campaign) {
        throw new Error('CAMPAIGN_NOT_FOUND');
      }

      if (campaign.status !== 'ACTIVE') {
        throw new Error('CAMPAIGN_NOT_ACTIVE');
      }

      const now = new Date();
      if (now < campaign.startTime || now > campaign.endTime) {
        throw new Error('CAMPAIGN_EXPIRED_OR_NOT_STARTED');
      }

      // 4. Check if user already has an active pledge for this campaign
      const existingPledge = await tx.pledge.findFirst({
        where: {
          userId,
          campaignId,
          status: {
            in: ['PLEDGED', 'PENDING_PAYMENT', 'CONFIRMED'],
          },
        },
      });
      if (existingPledge) {
        throw new Error('USER_ALREADY_PLEDGED');
      }

      // 5. Count existing active pledges for the campaign
      const activePledgeCount = await tx.pledge.count({
        where: {
          campaignId,
          status: {
            in: ['PLEDGED', 'PENDING_PAYMENT', 'CONFIRMED'],
          },
        },
      });

      // 6. Identify the current active price before this new pledge
      let lockedPrice = campaign.basePrice;
      for (const tier of campaign.tiers) {
        if (tier.isUnlocked || activePledgeCount >= tier.targetVolume) {
          lockedPrice = tier.unlockedPrice;
        }
      }

      // 7. Calculate advance and COD details (e.g. 10% advance)
      const tokenAdvancePaid = new Prisma.Decimal(lockedPrice).mul(0.1);
      const codAmountDue = new Prisma.Decimal(lockedPrice).sub(tokenAdvancePaid);

      // 8. Create the Pledge record
      const pledge = await tx.pledge.create({
        data: {
          userId,
          campaignId,
          lockedPrice,
          tokenAdvancePaid,
          codAmountDue,
          status: 'PLEDGED',
        },
      });

      // 9. Clean up waitlist if the user was on the waitlist
      await tx.waitlistEntry.deleteMany({
        where: { userId, campaignId },
      });

      // 10. Check if this new pledge crosses the threshold for any locked tier
      const newPledgeCount = activePledgeCount + 1;
      let nextPrice = lockedPrice;
      
      for (const tier of campaign.tiers) {
        if (!tier.isUnlocked && newPledgeCount >= tier.targetVolume) {
          await tx.tier.update({
            where: { id: tier.id },
            data: { isUnlocked: true },
          });
          nextPrice = tier.unlockedPrice;
        }
      }

      return {
        pledge,
        newPledgeCount,
        currentPrice: nextPrice,
      };
    });

    // 11. Broadcast Socket.io event after transaction commits successfully
    broadcastCampaignUpdate(campaignId, {
      pledgeCount: result.newPledgeCount,
      currentPrice: Number(result.currentPrice),
    });

    return res.status(201).json({
      success: true,
      message: 'Pledge placed successfully',
      data: {
        pledgeId: result.pledge.id,
        lockedPrice: result.pledge.lockedPrice,
        tokenAdvancePaid: result.pledge.tokenAdvancePaid,
        codAmountDue: result.pledge.codAmountDue,
        campaignPledgeCount: result.newPledgeCount,
        currentPrice: result.currentPrice,
      },
    });

  } catch (error) {
    console.error('Error placing pledge:', error);
    
    const err = error as Error;
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (err.message === 'CAMPAIGN_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    if (err.message === 'CAMPAIGN_NOT_ACTIVE') {
      return res.status(400).json({ success: false, message: 'Campaign is not active' });
    }
    if (err.message === 'CAMPAIGN_EXPIRED_OR_NOT_STARTED') {
      return res.status(400).json({ success: false, message: 'Campaign is outside active dates' });
    }
    if (err.message === 'USER_ALREADY_PLEDGED') {
      return res.status(409).json({ success: false, message: 'User has already pledged to this campaign' });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error during pledge creation',
    });
  }
}
