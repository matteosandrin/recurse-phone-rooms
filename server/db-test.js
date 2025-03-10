/**
 * Test Database Configuration
 *
 * This module provides a PostgreSQL pool configured specifically for tests.
 * It uses the pg_service.conf 'test' service when available, with fallback to direct connection.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

console.log('Setting up test database connection');

// Try to connect using the 'test' service from pg_service.conf
let pool;
let usingServiceConfig = false;

try {
  // Create a PostgreSQL connection pool using service definition
  pool = new pg.Pool({ service: 'test' });
  usingServiceConfig = true;
  console.log('Using pg_service.conf with [test] service');
} catch (err) {
  console.log('Failed to use service config, falling back to direct connection parameters:', err.message);

  // Ensure SSL is disabled for tests
  process.env.PGSSLMODE = 'disable';

  // Create PostgreSQL connection configuration
  const poolConfig = {
    user: process.env.VITE_DB_USER,
    host: process.env.VITE_DB_HOST,
    database: process.env.VITE_DB_NAME,
    password: process.env.VITE_DB_PASSWORD,
    port: parseInt(process.env.VITE_DB_PORT || '5432'),
    ssl: false
  };

  // Create a custom connection string with SSL mode explicitly disabled
  const connectionString = `postgresql://${poolConfig.user}:${poolConfig.password}@${poolConfig.host}:${poolConfig.port}/${poolConfig.database}?sslmode=disable`;

  // Create a PostgreSQL connection pool using connection string
  pool = new pg.Pool({
    connectionString: connectionString
  });

  // Log connection info
  console.log(`TEST DB POOL created with:`, {
    host: poolConfig.host,
    database: poolConfig.database,
    port: poolConfig.port,
    ssl: 'explicitly disabled'
  });
}

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('TEST DB ERROR:', err.message);
    console.error(`Connection details: ${JSON.stringify({
      service: usingServiceConfig ? 'test' : undefined,
      host: !usingServiceConfig ? process.env.VITE_DB_HOST : undefined,
      database: !usingServiceConfig ? process.env.VITE_DB_NAME : undefined,
      port: !usingServiceConfig ? process.env.VITE_DB_PORT : undefined,
      error: err.toString()
    }, null, 2)}`);
  } else {
    console.log('TEST DB connected:', res.rows[0].now);
  }
});

export default pool;