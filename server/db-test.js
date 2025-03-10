/**
 * Test Database Configuration
 *
 * This module provides a PostgreSQL pool configured specifically for tests.
 * It completely disables SSL to avoid connection issues with local databases.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });

// Log environment for debugging
console.log('TEST DB MODULE:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`- Database: ${process.env.VITE_DB_NAME}`);

// Force disable SSL protocol for test environment
console.log('TEST ENVIRONMENT: Explicitly disabling SSL for database connection');
process.env.PGSSLMODE = 'disable';

// Create PostgreSQL connection configuration
const poolConfig = {
  user: process.env.VITE_DB_USER,
  host: process.env.VITE_DB_HOST,
  database: process.env.VITE_DB_NAME,
  password: process.env.VITE_DB_PASSWORD,
  port: parseInt(process.env.VITE_DB_PORT || '5432'),
};

// Create a custom connection string with SSL mode explicitly disabled
const connectionString = `postgresql://${poolConfig.user}:${poolConfig.password}@${poolConfig.host}:${poolConfig.port}/${poolConfig.database}?sslmode=disable`;

// Create a PostgreSQL connection pool using connection string
const pool = new pg.Pool({
  connectionString: connectionString
});

// Log connection info
console.log(`TEST DB POOL created with:`, {
  host: poolConfig.host,
  database: poolConfig.database,
  port: poolConfig.port,
  ssl: 'explicitly disabled',
  connectionStringWithoutPassword: connectionString.replace(/:([^:@]+)@/, ':***@')
});

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('TEST DB ERROR:', err.message);
    console.error(`Connection details: ${JSON.stringify({
      host: process.env.VITE_DB_HOST,
      database: process.env.VITE_DB_NAME,
      port: process.env.VITE_DB_PORT,
      error: err.toString()
    }, null, 2)}`);
  } else {
    console.log('TEST DB connected:', res.rows[0].now);
  }
});

export default pool;