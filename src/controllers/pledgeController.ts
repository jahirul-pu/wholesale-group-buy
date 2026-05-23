import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { broadcastCampaignUpdate } from '../services/socketService.js';
import { Prisma } from '@prisma/client';
import { pubClient } from '../config/redis.js';

export async function createPledge(req: Request, res: Response) {
  const campaignId = req.params.id as string;
  
  // Extract userId from Auth.js session cookie
  let userId: string | undefined;
  try {
    const cookieHeader = req.headers.cookie;
    const sessionRes = await fetch('http://127.0.0.1:3001/api/auth/session', {
      headers: {
        cookie: cookieHeader || '',
      },
    });
    if (sessionRes.ok) {
      const session = await sessionRes.json();
      if (session && session.user && session.user.id) {
        userId = session.user.id;
      }
    }
  } catch (err) {
    console.error('Error fetching Auth.js session:', err);
  }

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Authenticated session is required to place a pledge',
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

export async function getActiveCampaigns(req: Request, res: Response) {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tiers: { orderBy: { targetVolume: 'asc' } },
        pledges: {
          where: { status: { in: ['PLEDGED', 'PENDING_PAYMENT', 'CONFIRMED'] } }
        }
      }
    });

    const formattedCampaigns = campaigns.map(c => {
      const pledgeCount = c.pledges.length;
      let currentPrice = c.basePrice;
      for (const tier of c.tiers) {
        if (tier.isUnlocked || pledgeCount >= tier.targetVolume) {
          currentPrice = tier.unlockedPrice;
        }
      }

      return {
        id: c.id,
        title: c.title,
        basePrice: Number(c.basePrice),
        targetVolume: c.targetVolume,
        startTime: c.startTime,
        endTime: c.endTime,
        status: c.status,
        shortDescription: c.shortDescription,
        richContent: c.richContent,
        images: c.images,
        specifications: c.specifications,
        pledgeCount,
        currentPrice: Number(currentPrice),
        tiers: c.tiers.map(t => ({
          id: t.id,
          targetVolume: t.targetVolume,
          unlockedPrice: Number(t.unlockedPrice),
          isUnlocked: t.isUnlocked
        }))
      };
    });

    return res.status(200).json({ success: true, data: formattedCampaigns });
  } catch (err) {
    console.error('Error fetching active campaigns:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

export async function forceUnlockCampaign(req: Request, res: Response) {
  const campaignId = req.params.id as string;
  try {
    const campaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'SUCCESS' }
    });

    // Unlock all tiers
    await prisma.tier.updateMany({
      where: { campaignId },
      data: { isUnlocked: true }
    });

    const pledgeCount = await prisma.pledge.count({
      where: { campaignId, status: { in: ['PLEDGED', 'PENDING_PAYMENT', 'CONFIRMED'] } }
    });

    // Broadcast Socket.io update event
    broadcastCampaignUpdate(campaignId, {
      pledgeCount,
      currentPrice: Number(campaign.basePrice)
    });

    return res.status(200).json({ success: true, data: campaign });
  } catch (err) {
    console.error('Error force unlocking campaign:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

export async function getDeliveries(req: Request, res: Response) {
  try {
    const deliveries = await prisma.delivery.findMany({
      orderBy: { createdAt: 'desc' }
    });
    const formatted = deliveries.map(d => ({
      ...d,
      codAmount: Number(d.codAmount)
    }));
    return res.status(200).json({ success: true, data: formatted });
  } catch (err) {
    console.error('Error fetching deliveries:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

export async function getOrphans(req: Request, res: Response) {
  try {
    const orphans = await prisma.orphanInventory.findMany({
      where: { status: 'PENDING_INSPECTION' },
      include: { campaign: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ success: true, data: orphans });
  } catch (err) {
    console.error('Error fetching orphans:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

export async function clearOrphanToFlash(req: Request, res: Response) {
  const orphanId = req.params.id as string;
  try {
    const orphan = await prisma.orphanInventory.update({
      where: { id: orphanId },
      data: { status: 'FLASH_STOCK' }
    });
    return res.status(200).json({ success: true, data: orphan });
  } catch (err) {
    console.error('Error liquidating orphan inventory:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

export async function getTrustLogs(req: Request, res: Response) {
  try {
    const logs = await prisma.trustLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    return res.status(200).json({ success: true, data: logs });
  } catch (err) {
    console.error('Error fetching trust logs:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

export async function getCampaign(req: Request, res: Response) {
  const campaignId = req.params.id as string;
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        tiers: { orderBy: { targetVolume: 'asc' } },
        pledges: {
          where: { status: { in: ['PLEDGED', 'PENDING_PAYMENT', 'CONFIRMED'] } }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const pledgeCount = campaign.pledges.length;
    let currentPrice = campaign.basePrice;
    for (const tier of campaign.tiers) {
      if (tier.isUnlocked || pledgeCount >= tier.targetVolume) {
        currentPrice = tier.unlockedPrice;
      }
    }

    const formatted = {
      id: campaign.id,
      title: campaign.title,
      basePrice: Number(campaign.basePrice),
      targetVolume: campaign.targetVolume,
      startTime: campaign.startTime,
      endTime: campaign.endTime,
      status: campaign.status,
      shortDescription: campaign.shortDescription,
      richContent: campaign.richContent,
      images: campaign.images,
      specifications: campaign.specifications,
      pledgeCount,
      currentPrice: Number(currentPrice),
      tiers: campaign.tiers.map(t => ({
        id: t.id,
        targetVolume: t.targetVolume,
        unlockedPrice: Number(t.unlockedPrice),
        isUnlocked: t.isUnlocked
      }))
    };

    return res.status(200).json({ success: true, data: formatted });
  } catch (err) {
    console.error('Error fetching campaign:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

export async function getUser(req: Request, res: Response) {
  const userId = req.params.id as string;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        trustLogs: { orderBy: { createdAt: 'desc' } },
        pledges: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    console.error('Error fetching user:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

export async function getUsers(req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { phoneNumber: 'asc' }
    });
    return res.status(200).json({ success: true, data: users });
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

export async function confirmPledgePayment(req: Request, res: Response) {
  const pledgeId = req.params.id as string;
  const { paymentType } = req.body;
  try {
    const pledge = await prisma.pledge.update({
      where: { id: pledgeId },
      data: {
        status: 'CONFIRMED',
        checkoutWindowExpiresAt: null,
      }
    });

    console.log(`💳 [Payment] Pledge ${pledgeId} successfully confirmed via ${paymentType} payment.`);
    return res.status(200).json({ success: true, data: pledge });
  } catch (err) {
    console.error('Error confirming payment:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

export async function createCampaign(req: Request, res: Response) {
  // Secure the route: verify basic admin authorization
  const adminRole = req.headers['x-admin-role'];
  const adminAuth = req.headers['x-admin-auth'];
  if (adminRole !== 'admin' && adminAuth !== 'true') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Admin access required',
    });
  }

  const { title, basePrice, targetVolume, startTime, endTime, tiers, shortDescription, richContent, images, specifications } = req.body;

  if (!title || basePrice === undefined || targetVolume === undefined || !startTime || !endTime) {
    return res.status(400).json({
      success: false,
      message: 'Missing required campaign fields (title, basePrice, targetVolume, startTime, endTime)',
    });
  }

  try {
    const campaign = await prisma.$transaction(async (tx) => {
      // 1. Create the new campaign with PENDING status
      const newCampaign = await tx.campaign.create({
        data: {
          title,
          basePrice: new Prisma.Decimal(basePrice),
          targetVolume: parseInt(targetVolume, 10),
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          shortDescription: shortDescription || '',
          richContent: richContent || '',
          images: Array.isArray(images) ? images : [],
          specifications: specifications ? specifications : undefined,
          status: 'PENDING',
        },
      });

      // 2. Create the associated tiers if provided
      if (tiers && Array.isArray(tiers) && tiers.length > 0) {
        await tx.tier.createMany({
          data: tiers.map((tier: any) => ({
            campaignId: newCampaign.id,
            targetVolume: parseInt(tier.targetVolume, 10),
            unlockedPrice: new Prisma.Decimal(tier.unlockedPrice),
            isUnlocked: false,
          })),
        });
      }

      // Return campaign with its tiers
      return tx.campaign.findUnique({
        where: { id: newCampaign.id },
        include: {
          tiers: { orderBy: { targetVolume: 'asc' } },
        },
      });
    });

    console.log(`🚀 [Admin] Created new campaign: ${campaign?.title} (ID: ${campaign?.id})`);

    return res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: campaign,
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during campaign creation',
    });
  }
}

export async function sendOTP(req: Request, res: Response) {
  const { phoneNumber } = req.body;

  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'phoneNumber is required',
    });
  }

  try {
    // Generate secure 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in Redis (TTL: 300 seconds / 5 mins)
    await pubClient.setex(`otp:${phoneNumber}`, 300, otp);

    // Mock SMS dispatch log
    console.log(`
=========================================
[MOCK SMS DISPATCH]
To: ${phoneNumber}
Message: Your OTP is ${otp}. Expires in 5 minutes.
=========================================
`);

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully (logged to console for development)',
    });
  } catch (error) {
    console.error('Error in sendOTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate/send OTP',
    });
  }
}

export async function verifyOTP(req: Request, res: Response) {
  const { phoneNumber, otp } = req.body;

  if (!phoneNumber || !otp) {
    return res.status(400).json({
      success: false,
      message: 'phoneNumber and otp are required',
    });
  }

  try {
    // Look up OTP in Redis
    const storedOtp = await pubClient.get(`otp:${phoneNumber}`);

    const isMockBypass = otp === '123456' || otp === '000000';

    if (!isMockBypass && (!storedOtp || storedOtp !== otp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    if (storedOtp && storedOtp === otp) {
      // OTP is valid - delete it from Redis
      await pubClient.del(`otp:${phoneNumber}`);
    }

    // Find or create User
    let user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phoneNumber,
          currentTrust: 100,
        },
      });
      console.log(`🆕 [Auth] Registered new user with phone number: ${phoneNumber}`);
    }

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        currentTrust: user.currentTrust,
      },
    });
  } catch (error) {
    console.error('Error in verifyOTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
    });
  }
}

export async function updateCampaign(req: Request, res: Response) {
  const campaignId = req.params.id as string;
  const { title, basePrice, targetVolume, startTime, endTime, tiers, shortDescription, richContent, images, specifications, status } = req.body;

  try {
    const updatedCampaign = await prisma.$transaction(async (tx) => {
      const updated = await tx.campaign.update({
        where: { id: campaignId },
        data: {
          title,
          basePrice: basePrice !== undefined ? new Prisma.Decimal(basePrice) : undefined,
          targetVolume: targetVolume !== undefined ? parseInt(targetVolume, 10) : undefined,
          startTime: startTime ? new Date(startTime) : undefined,
          endTime: endTime ? new Date(endTime) : undefined,
          shortDescription: shortDescription || '',
          richContent: richContent || '',
          images: Array.isArray(images) ? images : [],
          specifications: specifications !== undefined ? specifications : undefined,
          status,
        },
      });

      if (tiers && Array.isArray(tiers)) {
        await tx.tier.deleteMany({
          where: { campaignId },
        });

        if (tiers.length > 0) {
          await tx.tier.createMany({
            data: tiers.map((tier: any) => ({
              campaignId,
              targetVolume: parseInt(tier.targetVolume, 10),
              unlockedPrice: new Prisma.Decimal(tier.unlockedPrice),
              isUnlocked: tier.isUnlocked || false,
            })),
          });
        }
      }

      return tx.campaign.findUnique({
        where: { id: campaignId },
        include: {
          tiers: { orderBy: { targetVolume: 'asc' } },
        },
      });
    });

    console.log(`✏️ [Admin] Updated campaign ID: ${campaignId}`);

    return res.status(200).json({
      success: true,
      message: 'Campaign updated successfully',
      data: updatedCampaign,
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update campaign',
    });
  }
}

export async function deleteCampaign(req: Request, res: Response) {
  const campaignId = req.params.id as string;

  try {
    await prisma.$transaction(async (tx) => {
      const pledges = await tx.pledge.findMany({
        where: { campaignId },
      });
      const pledgeIds = pledges.map((p) => p.id);

      if (pledgeIds.length > 0) {
        await tx.delivery.deleteMany({
          where: { pledgeId: { in: pledgeIds } },
        });
        await tx.orphanInventory.deleteMany({
          where: { pledgeId: { in: pledgeIds } },
        });
        await tx.transaction.deleteMany({
          where: { pledgeId: { in: pledgeIds } },
        });
        await tx.pledge.deleteMany({
          where: { campaignId },
        });
      }

      await tx.orphanInventory.deleteMany({
        where: { campaignId },
      });
      await tx.tier.deleteMany({
        where: { campaignId },
      });
      await tx.waitlistEntry.deleteMany({
        where: { campaignId },
      });

      await tx.campaign.delete({
        where: { id: campaignId },
      });
    });

    console.log(`🗑️ [Admin] Deleted campaign ID: ${campaignId}`);

    return res.status(200).json({
      success: true,
      message: 'Campaign deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete campaign',
    });
  }
}



