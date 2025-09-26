/**
 * UniPile Metrics Backend Service
 * Express server with TypeScript for invitation metrics processing
 */

import express from 'express';
import { getDailyInvitationMetrics } from './routes/metrics';

// Environment configuration
process.env.PORT = '3000';
process.env.NODE_ENV = 'development';
process.env.GOOGLE_APPLICATION_CREDENTIALS = 'd:\\Task\\data\\unipile-ec7ec-firebase-adminsdk-fbsvc-fb04d8e6d7.json';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'unipile-metrics-backend'
  });
});

// Main metrics endpoint
app.get('/metrics/invitations/daily', getDailyInvitationMetrics);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    details: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    details: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 UniPile Metrics Backend Server running on port ${PORT}`);
  console.log(`📊 Metrics endpoint: http://localhost:${PORT}/metrics/invitations/daily`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`🔥 Using Firestore emulator at: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  } else {
    console.log(`🔥 Using production Firestore (ensure GOOGLE_APPLICATION_CREDENTIALS is set)`);
  }
});

export default app;