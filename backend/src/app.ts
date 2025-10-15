import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';

// Import routes
import authRoutes from './routes/auth.routes';
import tripGroupRoutes from './routes/tripGroup.routes';
import tripRoutes from './routes/trip.routes';
import chatRoutes from './routes/chat.routes';
import itemRoutes from './routes/savedItem.routes';
import locationRoutes from './routes/location.routes';

const app: Application = express();

// Trust proxy - required for Railway and other cloud platforms
// This allows rate limiting to work correctly with X-Forwarded-For headers
app.set('trust proxy', true);

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: '*', // Allow all origins for development
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/api/items', itemRoutes);       // Direct item operations
app.use('/api/location', locationRoutes); // Location services

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

