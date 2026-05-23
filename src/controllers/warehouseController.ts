import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { OrphanStatus } from '@prisma/client';

export async function handleWarehouseIngest(req: Request, res: Response) {
  const { orphanInventoryId, action } = req.body;

  if (!orphanInventoryId || !action) {
    return res.status(400).json({
      success: false,
      message: 'Bad Request: orphanInventoryId and action are required',
    });
  }

  if (action !== 'RESTOCK' && action !== 'DAMAGED') {
    return res.status(400).json({
      success: false,
      message: 'Bad Request: action must be RESTOCK or DAMAGED',
    });
  }

  try {
    const orphan = await prisma.orphanInventory.findUnique({
      where: { id: orphanInventoryId },
    });

    if (!orphan) {
      return res.status(404).json({
        success: false,
        message: `OrphanInventory record not found for ID: ${orphanInventoryId}`,
      });
    }

    if (action === 'RESTOCK') {
      const updatedOrphan = await prisma.orphanInventory.update({
        where: { id: orphanInventoryId },
        data: { status: OrphanStatus.FLASH_STOCK },
      });

      console.log(`📦 [Warehouse Ingest] Orphan inventory ${orphanInventoryId} restocked to FLASH_STOCK.`);
      return res.status(200).json({
        success: true,
        message: 'Orphan inventory successfully restocked to FLASH_STOCK.',
        data: updatedOrphan,
      });
    } else {
      // action === 'DAMAGED'
      console.log(`📦 [Warehouse Ingest] Orphan inventory ${orphanInventoryId} marked as DAMAGED. Left in PENDING_INSPECTION.`);
      return res.status(200).json({
        success: true,
        message: 'Orphan inventory marked as DAMAGED. No restocking was performed.',
        data: orphan,
      });
    }
  } catch (err) {
    console.error('Error in warehouse ingestion:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during warehouse ingestion',
    });
  }
}
