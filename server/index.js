// Load environment variables from .env file
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { canDeleteBooking } from './auth-middleware.js';
import { DbClient } from './db.js';
import fs from 'fs';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables with proper priority
console.log('=== Environment Setup ===');
// Clear any existing environment variables that might conflict
['VITE_RECURSE_CLIENT_ID', 'VITE_RECURSE_CLIENT_SECRET', 'VITE_OAUTH_REDIRECT_URI'].forEach(key => {
  if (process.env[key]) {
    console.log(`Clearing existing ${key}`);
    delete process.env[key];
  }
});

// Load environment variables - prioritize .env.local for development
console.log(`Current NODE_ENV: ${process.env.NODE_ENV}`);
// First try to load .env.local (highest priority)
const localEnvPath = path.resolve(__dirname, '..', '.env.local');
const localEnvResult = dotenv.config({ path: localEnvPath });
if (localEnvResult.error) {
  console.log('No .env.local found or error loading it:', localEnvResult.error.message);

  // As a fallback, try to load from .env.example
  const exampleEnvPath = path.resolve(__dirname, '..', '.env.example');
  if (fs.existsSync(exampleEnvPath)) {
    console.log('Falling back to .env.example as a template');
    dotenv.config({ path: exampleEnvPath });
  }
} else {
  console.log('Successfully loaded environment from .env.local');
}

// Check critical environment variables
console.log('\n=== OAuth Configuration ===');
if (!process.env.VITE_RECURSE_CLIENT_ID) {
  console.error('ERROR: Missing VITE_RECURSE_CLIENT_ID');
} else {
  console.log(`Client ID: ${process.env.VITE_RECURSE_CLIENT_ID.substring(0, 8)}...`);
}

if (!process.env.VITE_RECURSE_CLIENT_SECRET) {
  console.error('ERROR: Missing VITE_RECURSE_CLIENT_SECRET');
} else {
  console.log('Client Secret: Present');
}

if (!process.env.VITE_OAUTH_REDIRECT_URI) {
  console.error('ERROR: Missing VITE_OAUTH_REDIRECT_URI');
} else {
  console.log(`Redirect URI: ${process.env.VITE_OAUTH_REDIRECT_URI}`);
}
console.log('========================\n');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS to allow requests from our frontend
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://recurse-bookings-production.up.railway.app',
    'https://phoneroom.recurse.com'
  ],
  credentials: true
}));

// Parse JSON request bodies
app.use(express.json());

// Database connection
const db = new DbClient();

// Connect to the database
db.connect()
  .then(() => {
    console.log('Database connected successfully');
  })
  .catch(err => {
    console.error('Database connection error:', err.message);
    console.error('Connection details:', {
      host: process.env.VITE_DB_HOST,
      database: process.env.VITE_DB_NAME,
      port: process.env.VITE_DB_PORT,
      error: err.stack
    });
  });

// Serve static files from the dist directory in production
app.use(express.static(path.join(__dirname, '../dist')));

// Log environment information for debugging
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('OAuth Redirect URI:', process.env.VITE_OAUTH_REDIRECT_URI);
if (process.env.VITE_OAUTH_REDIRECT_URI?.includes('localhost:3000')) {
  console.warn('\nWARNING: Your OAuth redirect URI is set to port 3000, but your frontend is likely running on port 5173.');
  console.warn('This can cause authentication issues. Update your .env.local file and Recurse Center OAuth app settings.\n');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API route to handle OAuth token exchange
app.post('/api/auth/callback', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    console.log('Processing OAuth code exchange');

    // Exchange authorization code for access token
    let tokenResponse;
    try {
      // Send the token request using URLSearchParams for the form data
      tokenResponse = await axios({
        method: 'post',
        url: 'https://www.recurse.com/oauth/token',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        data: new URLSearchParams({
          client_id: process.env.VITE_RECURSE_CLIENT_ID,
          client_secret: process.env.VITE_RECURSE_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: process.env.VITE_OAUTH_REDIRECT_URI
        }).toString()
      });

      console.log('Successfully obtained access token');
    } catch (tokenError) {
      console.error('OAuth token exchange error:', tokenError.message);
      return res.status(401).json({
        error: 'Failed to exchange authorization code for token',
        details: tokenError.response?.data || { error: 'unknown_error' }
      });
    }

    const { access_token } = tokenResponse.data;

    // Get user info from Recurse API
    let userResponse;
    try {
      console.log('Attempting to fetch user profile from Recurse API');
      userResponse = await axios.get('https://www.recurse.com/api/v1/profiles/me', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });
      console.log('Successfully received user profile response');
    } catch (profileError) {
      console.error('Error fetching user profile:', profileError.message);
      return res.status(500).json({ error: 'Failed to fetch user profile from Recurse Center' });
    }

    const userData = userResponse.data;
    console.log('Retrieved user profile for:', userData.email);

    // Create or update user in our database
    try {
      console.log('Attempting to save user to database with recurse_id:', userData.id);

      // First check if user with this recurse_id already exists
      const userCheck = await db.query('SELECT * FROM users WHERE recurse_id = $1', [userData.id]);

      let dbUser;
      if (userCheck.rows.length > 0) {
        // Update existing user
        console.log('Found existing user, updating...');
        const updateResult = await db.query(
          `UPDATE users
           SET email = $2, name = $3, access_token = $4, updated_at = CURRENT_TIMESTAMP
           WHERE recurse_id = $1
           RETURNING id, recurse_id, email, name`,
          [userData.id, userData.email, userData.name, access_token]
        );
        dbUser = updateResult.rows[0];
      } else {
        // Insert new user with auto-generated ID
        console.log('No existing user found, creating new user...');
        const insertResult = await db.query(
          `INSERT INTO users (recurse_id, email, name, access_token)
           VALUES ($1, $2, $3, $4)
           RETURNING id, recurse_id, email, name`,
          [userData.id, userData.email, userData.name, access_token]
        );
        dbUser = insertResult.rows[0];
      }

      console.log('User data saved to database, ID:', dbUser.id);

      // Return user data to frontend
      res.json({
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        recurseId: dbUser.recurse_id,
        accessToken: access_token
      });
    } catch (dbError) {
      console.error('Database error during user save:', dbError.message);
      return res.status(500).json({ error: 'Failed to save user data to database', details: dbError.message });
    }
  } catch (error) {
    console.error('Unhandled OAuth error:', error.message);
    res.status(500).json({
      error: 'A server error occurred during authentication',
      details: { error: 'server_error' }
    });
  }
});

// API route to get rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM rooms ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// API route to get bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const { user_id } = req.query;

    let query = `
      SELECT b.*, r.name as room_name, u.email as user_email, u.name as user_name
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      JOIN users u ON b.user_id = u.id
    `;

    const params = [];

    if (user_id) {
      query += ` WHERE b.user_id = $1`;
      params.push(user_id);
    }

    query += ` ORDER BY b.start_time`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// API route to create a booking
app.post('/api/bookings', async (req, res) => {
  const { user_id, room_id, start_time, end_time, notes } = req.body;

  try {
    // Check for booking conflicts
    const conflictCheck = await db.query(
      `SELECT COUNT(*) as count
       FROM bookings
       WHERE room_id = $1
       AND $2 < end_time
       AND $3 > start_time`,
      [room_id, start_time, end_time]
    );

    if (parseInt(conflictCheck.rows[0].count) > 0) {
      return res.status(409).json({ error: 'This time slot is already booked' });
    }

    // Create the booking
    const result = await db.query(
      `INSERT INTO bookings (user_id, room_id, start_time, end_time, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user_id, room_id, start_time, end_time, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// API route to check booking availability
app.get('/api/bookings/check-availability', async (req, res) => {
  const { room_id, start_time, end_time } = req.query;

  try {
    const result = await db.query(
      `SELECT COUNT(*) as count
       FROM bookings
       WHERE room_id = $1
       AND $2 < end_time
       AND $3 > start_time`,
      [room_id, new Date(start_time), new Date(end_time)]
    );

    res.json({ available: parseInt(result.rows[0].count) === 0 });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// API route to delete a booking
app.delete('/api/bookings/:id', canDeleteBooking, async (req, res) => {
  const bookingId = req.params.id;

  try {
    // The canDeleteBooking middleware has already checked if the booking exists
    // and if the user has permission to delete it, so we can proceed with deletion

    // Delete the booking
    await db.query(
      'DELETE FROM bookings WHERE id = $1',
      [bookingId]
    );

    res.status(200).json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// Special endpoint for test setup (only available in development mode)
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/test/setup-users', async (req, res) => {
    try {
      const { users } = req.body;

      if (!users || !Array.isArray(users)) {
        return res.status(400).json({ error: 'Users array is required' });
      }

      // Create users in the database
      for (const user of users) {
        await db.query(
          `INSERT INTO users (id, recurse_id, email, name, access_token)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE
           SET recurse_id = $2, email = $3, name = $4, access_token = $5`,
          [user.id, user.recurse_id, user.email, user.name, user.access_token || 'mock-token']
        );
        console.log(`Test user ${user.name} (ID: ${user.id}) created or updated`);
      }

      res.status(200).json({ message: 'Test users created or updated successfully' });
    } catch (error) {
      console.error('Error setting up test users:', error);
      res.status(500).json({ error: 'Failed to set up test users' });
    }
  });
}

// Catch-all route to handle frontend routing
// This must be AFTER all API routes
app.get('*', (req, res) => {
  // For any request that doesn't match an API route, send the main index.html
  // This allows the client-side router to handle the route
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});