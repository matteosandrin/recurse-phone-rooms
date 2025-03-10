/**
 * Test Server Startup Script
 *
 * This script ensures that the server is started with the correct test environment variables.
 */

import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Clear any previous environment variables that might interfere
process.env.VITE_DB_NAME = undefined;

// Load test environment variables
const envPath = path.resolve(__dirname, '..', '.env.test');
console.log(`Loading test environment from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading test environment variables:', result.error);
  process.exit(1);
}

// Force test database to be used
if (!process.env.VITE_DB_NAME || !process.env.VITE_DB_NAME.endsWith('_test')) {
  console.error('Test database is not correctly specified. Environment file might be incorrect.');
  console.error('Current VITE_DB_NAME:', process.env.VITE_DB_NAME);
  console.error('Forcing test database name...');
  process.env.VITE_DB_NAME = 'recurse_bookings_test';
}

// Ensure SSL is disabled for tests
process.env.VITE_DB_SSL = 'false';

// Log the loaded environment for debugging
console.log('Environment variables loaded:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- VITE_DB_HOST:', process.env.VITE_DB_HOST);
console.log('- VITE_DB_NAME:', process.env.VITE_DB_NAME);
console.log('- VITE_DB_SSL:', process.env.VITE_DB_SSL);
console.log('- SSL Disabled:', process.env.VITE_DB_SSL === 'false');

// Import and start the server
import './index.js';