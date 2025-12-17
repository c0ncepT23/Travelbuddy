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
    logger.info('✅ Schema migration completed');

    // Run individual migration files from migrations folder
    const migrationsPath = path.join(__dirname, '../../migrations');
    if (fs.existsSync(migrationsPath)) {
      const migrationFiles = fs.readdirSync(migrationsPath)
        .filter(f => f.endsWith('.sql'))
        .sort();
      
      for (const file of migrationFiles) {
        try {
          const migrationSql = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
          await pool.query(migrationSql);
          logger.info(`✅ Applied migration: ${file}`);
        } catch (migrationError: any) {
          // Ignore "already exists" and similar idempotency errors
          const ignorableCodes = [
            '42P07', // relation already exists
            '42701', // column already exists
            '42710', // constraint already exists
            '42P16', // cannot drop columns from view (view already exists with different columns)
            '42723', // function already exists
            '42P01', // undefined table (migration already cleaned up)
            '23505', // unique_violation (data already exists)
          ];
          if (ignorableCodes.includes(migrationError.code)) {
            logger.info(`⏭️ Skipped migration (already applied): ${file}`);
          } else {
            throw migrationError;
          }
        }
      }
    }

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

