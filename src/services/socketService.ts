import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import { pubClient, subClient } from '../config/redis.js';

let io: Server | null = null;

export async function initSocketServer(httpServer: HttpServer): Promise<Server> {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  try {
    // Attempt connections
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Socket.io Redis adapter initialized successfully.');
  } catch (error) {
    console.warn(
      '⚠️ Failed to connect to Redis. Socket.io falling back to standard in-memory adapter.',
      (error as Error).message
    );
  }

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function broadcastCampaignUpdate(
  campaignId: string,
  data: {
    pledgeCount: number;
    currentPrice: number;
  }
) {
  if (!io) {
    console.warn('⚠️ Socket.io is not initialized yet. Skipping broadcast.');
    return;
  }

  console.log(`📢 Broadcasting CAMPAIGN_UPDATED for campaign ${campaignId}:`, data);
  
  // Emits via adapter (which publishes to Redis pub/sub if active, or broadcasts locally)
  io.emit('CAMPAIGN_UPDATED', {
    campaignId,
    ...data,
  });
}
