/**
 * OAuth Development Helper
 *
 * This script provides utilities for testing and debugging OAuth integration
 * in the development environment.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
console.log('Loading environment variables...');
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') }); // Try local first
dotenv.config(); // Fall back to default

// Display OAuth configuration
console.log('\n--- OAuth Configuration ---');
console.log('Client ID:', process.env.VITE_RECURSE_CLIENT_ID?.substring(0, 5) + '...');
console.log('Redirect URI:', process.env.VITE_OAUTH_REDIRECT_URI);
console.log('Note: Make sure this redirect URI is registered with Recurse Center');

// Create simple server to help with OAuth testing
async function startServer() {
  const app = express();
  const PORT = 3002; // Using port 3002 to avoid conflicts

  app.get('/test-oauth', (req, res) => {
    const clientId = process.env.VITE_RECURSE_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.VITE_OAUTH_REDIRECT_URI);
    const authUrl = `https://www.recurse.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;

    res.send(`
      <html>
        <head>
          <title>OAuth Test</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow: auto; }
            .button { display: inline-block; background: #4f46e5; color: white; padding: 10px 20px;
                     text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .important { color: #e53e3e; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>OAuth Development Test</h1>
          <p>This page helps test your OAuth configuration:</p>

          <h2>Current Configuration:</h2>
          <pre>
Client ID: ${process.env.VITE_RECURSE_CLIENT_ID?.substring(0, 5)}...
Redirect URI: ${process.env.VITE_OAUTH_REDIRECT_URI}
          </pre>

          <div class="important">
            <p>Important: Make sure this redirect URI is registered with Recurse Center's OAuth application settings!</p>
            <p>Your frontend must be running at this URL for the redirect to work.</p>
          </div>

          <p>Click the button below to initiate the OAuth flow:</p>
          <a href="${authUrl}" class="button">Start OAuth Flow</a>

          <h2>Troubleshooting:</h2>
          <ul>
            <li>Ensure your .env.local file is properly configured</li>
            <li>Make sure the redirect URI matches what's registered with Recurse Center</li>
            <li>Verify that your frontend is running at the redirect URI's host/port</li>
            <li>Check the browser console and server logs for errors</li>
          </ul>
        </body>
      </html>
    `);
  });

  app.listen(PORT, () => {
    console.log(`\nOAuth test server running at http://localhost:${PORT}/test-oauth`);
    console.log('\nOpen the URL above to test your OAuth configuration.');
  });
}

// Start the test server
startServer().catch(err => {
  console.error('Error starting test server:', err);
});