import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initSocketServer } from './services/socketService.js';
import pledgeRoutes from './routes/pledgeRoutes.js';
import './workers/pledgeExpirationWorker.js';

const app = express();
const httpServer = createServer(app);

// Configure Middleware
app.use(cors());
app.use(express.json());

// Expose routing API endpoints
app.use('/api', pledgeRoutes);

// Simple Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

const PORT = process.env.PORT || 3000;

// Initialize HTTP server & Socket.io server
async function startServer() {
  await initSocketServer(httpServer);
  
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server successfully running on http://127.0.0.1:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});
