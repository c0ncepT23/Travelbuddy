import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import logger from '../config/logger';

const runMigration = async () => {
  try {
    logger.info('Starting database migration...');

    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    await pool.query(schema);

    logger.info('✅ Database migration completed successfully');
    
    // Close pool
    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Database migration failed:', error);
    await pool.end();
    process.exit(1);
  }
};

runMigration();

