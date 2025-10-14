import http from 'http';
import app from './app';
import { config } from './config/env';
import logger from './config/logger';
import { pool } from './config/database';

const server = http.createServer(app);

// Initialize Socket.IO (will be configured later)
// import { Server as SocketServer } from 'socket.io';
// const io = new SocketServer(server, { cors: { origin: config.cors.origin } });

const PORT = config.port;

// Test database connection
const testDatabaseConnection = async () => {
  try {
    await pool.query('SELECT NOW()');
    logger.info('✅ Database connection verified');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    logger.error('Make sure PostgreSQL is running and configured correctly');
    // Don't exit in development, allow server to start
    if (config.nodeEnv === 'production') {
      process.exit(1);
    }
  }
};

// Start server
const startServer = async () => {
  try {
    await testDatabaseConnection();

    server.listen(PORT, () => {
      logger.info('=================================');
      logger.info(`🚀 Travel Agent API Server Started`);
      logger.info(`📡 Environment: ${config.nodeEnv}`);
      logger.info(`🌐 Port: ${PORT}`);
      logger.info(`🔗 URL: http://localhost:${PORT}`);
      logger.info(`💚 Health Check: http://localhost:${PORT}/health`);
      logger.info('=================================');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    pool.end(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    pool.end(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });
});

startServer();

