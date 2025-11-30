import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';

// Import routes
import authRoutes from './routes/auth.routes';
import tripGroupRoutes from './routes/tripGroup.routes';
import tripRoutes from './routes/trip.routes';
import chatRoutes from './routes/chat.routes';
import itemRoutes from './routes/savedItem.routes';
import locationRoutes from './routes/location.routes';
import aiCompanionRoutes from './routes/aiCompanion.routes';
import checkInRoutes from './routes/checkIn.routes';
import groupMessageRoutes from './routes/groupMessage.routes';
import notificationRoutes from './routes/notification.routes';
import segmentRoutes from './routes/segment.routes';
import dailyPlanRoutes from './routes/dailyPlan.routes';

const app: Application = express();

// Trust the first proxy in production (Railway) so client IP is preserved, but
// keep default behavior locally to avoid permissive trust proxy settings
const trustProxySetting = config.nodeEnv === 'production' ? 1 : false;
app.set('trust proxy', trustProxySetting);

// Security middleware
app.use(helmet());

// CORS configuration - restrict in production
const corsOrigin = config.nodeEnv === 'production'
  ? config.cors.origin // Use configured origins in production
  : '*'; // Allow all origins only in development

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (for web story viewer)
app.use('/public', express.static(path.join(__dirname, '../public')));

// Rate limiting
app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Travel Agent API is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripGroupRoutes);  // Trip CRUD operations
app.use('/api/trips', tripRoutes);        // Trip items and search
app.use('/api/trips', chatRoutes);       // Chat within trips
app.use('/api/trips', segmentRoutes);    // Trip segments (itinerary)
app.use('/api/trips', dailyPlanRoutes);  // Daily plans
app.use('/api/items', itemRoutes);       // Direct item operations
app.use('/api/location', locationRoutes); // Location services
app.use('/api/companion', aiCompanionRoutes); // AI Companion queries
app.use('/api', checkInRoutes); // Check-ins and trip stories
app.use('/api', groupMessageRoutes); // Group chat messages
app.use('/api/notifications', notificationRoutes); // Push notifications

// Public story web viewer route
app.get('/story/:shareCode', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/story.html'));
});

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

