/**
 * Database Configuration
 *
 * This module provides a PostgreSQL client that works for all environments:
 * - Development: Uses local database
 * - Test: Uses test database
 * - Production: Uses production database with SSL
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables based on NODE_ENV
console.log(`Current NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

if (process.env.NODE_ENV === 'test') {
  console.log('Loading test environment variables from .env.test');
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });
} else {
  console.log('Loading development environment variables');
  const localEnvPath = path.resolve(__dirname, '..', '.env.local');
  const localEnvResult = dotenv.config({ path: localEnvPath });

  // If .env.local failed, try .env.example as a fallback
  if (localEnvResult.error) {
    console.log('No .env.local found or error loading it, checking for .env.example');
    const exampleEnvPath = path.resolve(__dirname, '..', '.env.example');
    if (fs.existsSync(exampleEnvPath)) {
      dotenv.config({ path: exampleEnvPath });
    }
  }
}

// Determine which database service to use based on environment
function getDatabaseService() {
  if (process.env.NODE_ENV === 'test') {
    return 'test';
  } else if (process.env.NODE_ENV === 'production') {
    return 'prod';
  } else {
    return 'local';
  }
}

// Get the database name based on environment
function getDatabaseName() {
  if (process.env.NODE_ENV === 'test') {
    return process.env.VITE_DB_NAME || 'recurse_bookings_test';
  } else {
    return process.env.VITE_DB_NAME || 'recurse_bookings';
  }
}

// Check if we should use a Pool or Client
const usePool = process.env.NODE_ENV === 'test';

// Detect if we're running in GitHub Actions
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

// Create a wrapper around pg.Client/Pool that provides a consistent interface
export class DbClient {
  constructor() {
    this.client = null;
    this.connected = false;
    this.service = getDatabaseService();
    this.isTestEnv = process.env.NODE_ENV === 'test';
    console.log(`Using database service: ${this.service}`);
  }

  async connect() {
    if (this.connected) return;

    try {
      const databaseName = getDatabaseName();

      // In GitHub Actions, use direct connection parameters to avoid service file issues
      if (isGitHubActions) {
        console.log('Detected GitHub Actions environment, using direct connection parameters');
        const dbConfig = {
          user: process.env.VITE_DB_USER,
          host: process.env.VITE_DB_HOST,
          database: databaseName,
          password: process.env.VITE_DB_PASSWORD,
          port: parseInt(process.env.VITE_DB_PORT || '5432'),
          ssl: process.env.VITE_DB_SSL === 'true'
            ? { rejectUnauthorized: true }
            : false
        };

        // Log database connection details (excluding password)
        console.log('Connecting with:', {
          user: dbConfig.user,
          host: dbConfig.host,
          database: dbConfig.database,
          port: dbConfig.port,
          ssl: dbConfig.ssl ? 'enabled' : 'disabled'
        });

        // Use Pool for test environment
        this.client = new pg.Pool(dbConfig);
        this.connected = true;
        console.log('Database connected successfully using direct parameters');
        return;
      }

      // For local environments, try using pg_service.conf first
      // Set PGSERVICEFILE environment variable to look for pg_service.conf in the project directory
      const pgServicePath = path.resolve(__dirname, '..', 'pg_service.conf');
      if (fs.existsSync(pgServicePath)) {
        process.env.PGSERVICEFILE = pgServicePath;
        console.log(`Using project pg_service.conf: ${pgServicePath}`);
      }

      // Service configuration with explicit database name
      const serviceConfig = {
        service: this.service,
        database: databaseName // Prevent defaulting to OS username
      };

      console.log(`Connecting to service '${this.service}' with database: ${databaseName}`);

      // Use Pool for test environment and Client for development/production
      if (usePool) {
        this.client = new pg.Pool(serviceConfig);
      } else {
        this.client = new pg.Client(serviceConfig);

        // If we're using the 'prod' service and have a PGPASSWORD environment variable,
        // override the password to avoid storing it in the service file
        if (this.service === 'prod' && process.env.PGPASSWORD) {
          this.client.password = process.env.PGPASSWORD;
        }

        // For Client, we need to explicitly connect
        await this.client.connect();
      }

      this.connected = true;
      console.log('Database connected successfully');
    } catch (err) {
      console.error('Database connection error:', err.message);

      // If using service definition failed, try direct connection as fallback
      console.log('Service connection failed, trying direct connection parameters...');
      try {
        // Use environment variables directly
        const dbConfig = {
          user: process.env.VITE_DB_USER,
          host: process.env.VITE_DB_HOST,
          database: getDatabaseName(),
          password: process.env.VITE_DB_PASSWORD,
          port: parseInt(process.env.VITE_DB_PORT || '5432'),
          ssl: process.env.VITE_DB_SSL === 'true'
            ? { rejectUnauthorized: true }
            : (process.env.VITE_DB_SSL === 'no-verify'
              ? { rejectUnauthorized: false }
              : false)
        };

        // Log database connection details (excluding password)
        console.log('Attempting connection with:', {
          user: dbConfig.user,
          host: dbConfig.host,
          database: dbConfig.database,
          port: dbConfig.port,
          ssl: dbConfig.ssl ? 'enabled' : 'disabled'
        });

        // Use Pool for test environment and Client for development/production
        if (usePool) {
          // For test, create a pool with the direct config
          this.client = new pg.Pool(dbConfig);
        } else {
          this.client = new pg.Client(dbConfig);
          await this.client.connect();
        }

        this.connected = true;
        console.log('Database connected successfully using direct parameters');
      } catch (fallbackErr) {
        console.error('Fallback connection also failed:', fallbackErr.message);

        // If the database doesn't exist, provide helpful info
        if (fallbackErr.message.includes('does not exist')) {
          if (this.isTestEnv) {
            console.error('\n=== TEST DATABASE SETUP REQUIRED ===');
            console.error('It appears the test database does not exist. You need to run:');
            console.error('npm run setup:test-db');
            console.error('====================================\n');
          } else {
            console.error('\n=== DATABASE SETUP REQUIRED ===');
            console.error('It appears the database does not exist. You need to create it:');
            console.error('createdb recurse_bookings');
            console.error('================================\n');
          }
        }

        this.client = null;
        this.connected = false;
        throw fallbackErr;
      }
    }
  }

  async query(text, params = []) {
    // Ensure we're connected
    if (!this.connected) {
      await this.connect();
    }

    try {
      return await this.client.query(text, params);
    } catch (err) {
      console.error('Query error:', err.message);
      throw err;
    }
  }

  async end() {
    if (this.client) {
      if (usePool) {
        await this.client.end();
      } else {
        await this.client.end();
      }
      this.client = null;
      this.connected = false;
      console.log('Database connection closed');
    }
  }
}

// Create a single instance
const db = new DbClient();

// Test the connection
db.connect()
  .then(() => db.query('SELECT NOW()'))
  .then(res => {
    console.log('Database test query successful:', res.rows[0].now);
  })
  .catch(err => {
    console.error('Database connection test failed:', err.message);
  });

export default db;