// Load environment variables from .env file
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';
import { authenticate, canDeleteBooking } from './auth-middleware.js';
import { runMigration } from '../migrations/run-migrations.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure CORS to allow requests from our frontend
app.use(cors({
  origin: ['http://localhost:5173', 'https://recurse-bookings-production.up.railway.app'],
  credentials: true
}));

// Parse JSON request bodies
app.use(express.json());

// Serve static files from the dist directory in production
app.use(express.static(path.join(__dirname, '../dist')));

// Special endpoint for test setup (only available in development mode)
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/test/setup-users', async (req, res) => {
    const { users } = req.body;

    if (!users || !Array.isArray(users)) {
      return res.status(400).json({ error: 'Users array is required' });
    }

    try {
      // Begin transaction
      await pool.query('BEGIN');

      // Insert/update each user
      for (const user of users) {
        // Check if required fields are present
        if (!user.id || !user.name || !user.email) {
          await pool.query('ROLLBACK');
          return res.status(400).json({ error: 'Each user must have id, name, and email' });
        }

        // Check if user exists
        const checkResult = await pool.query(
          'SELECT * FROM users WHERE id = $1',
          [user.id]
        );

        if (checkResult.rows.length === 0) {
          // Insert new user
          await pool.query(
            `INSERT INTO users (id, name, email, recurse_id, access_token)
             VALUES ($1, $2, $3, $4, $5)`,
            [user.id, user.name, user.email, user.recurse_id || null, 'test-token']
          );
          console.log(`Created test user: ${user.name} (ID: ${user.id})`);
        } else {
          // Update existing user
          await pool.query(
            `UPDATE users SET
             name = $2,
             email = $3,
             recurse_id = $4
             WHERE id = $1`,
            [user.id, user.name, user.email, user.recurse_id || null]
          );
          console.log(`Updated test user: ${user.name} (ID: ${user.id})`);
        }
      }

      // Commit transaction
      await pool.query('COMMIT');

      res.status(200).json({ success: true, message: `${users.length} test users configured` });
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK').catch(() => { });
      console.error('Error setting up test users:', error);
      res.status(500).json({ error: 'Failed to set up test users', details: error.message });
    }
  });
}

// API route to handle OAuth token exchange
app.post('/api/auth/callback', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    console.log('Processing authorization code:', code.substring(0, 5) + '...');

    // Exchange authorization code for access token
    let tokenResponse;
    try {
      tokenResponse = await axios.post('https://www.recurse.com/oauth/token', {
        client_id: process.env.VITE_RECURSE_CLIENT_ID,
        client_secret: process.env.VITE_RECURSE_CLIENT_SECRET,
        redirect_uri: process.env.VITE_OAUTH_REDIRECT_URI,
        code,
        grant_type: 'authorization_code'
      });
    } catch (tokenError) {
      console.error('OAuth token exchange error:', tokenError.response?.data || tokenError.message);
      return res.status(400).json({
        error: 'Failed to exchange authorization code for token',
        details: tokenError.response?.data || { message: tokenError.message }
      });
    }

    const { access_token, token_type } = tokenResponse.data;

    if (!access_token) {
      return res.status(400).json({ error: 'No access token received' });
    }

    // Get user info from Recurse API
    try {
      const userResponse = await axios.get('https://www.recurse.com/api/v1/profiles/me', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });

      const userData = userResponse.data;

      // Extract user data we need
      const user = {
        id: userData.id.toString(),
        email: userData.email,
        name: userData.name,
        recurseId: userData.id,
        accessToken: access_token
      };

      // Return user data to client
      res.status(200).json(user);
    } catch (profileError) {
      console.error('Failed to get profile:', profileError.message);
      return res.status(400).json({
        error: 'Failed to fetch user profile',
        details: { message: profileError.message }
      });
    }
  } catch (error) {
    console.error('Unhandled OAuth error:', error.message);
    res.status(500).json({
      error: 'A server error occurred during authentication',
      details: { message: error.message }
    });
  }
});

// API route to get all rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rooms ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// API route to get all bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, r.name as room_name, u.email as user_email, u.name as user_name
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      LEFT JOIN users u ON b.user_id = u.id
      ORDER BY b.start_time
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// API route to create a booking
// Add authentication middleware
app.post('/api/bookings', authenticate, async (req, res) => {
  // If we have authentication, use the authenticated user ID
  // Otherwise, use the one from the request body
  const user_id = req.userId || req.body.user_id;
  const { room_id, start_time, end_time, notes } = req.body;

  try {
    // Check for booking conflicts
    const conflictCheck = await pool.query(
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
    const result = await pool.query(
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
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM bookings
       WHERE room_id = $1
       AND $2 < end_time
       AND $3 > start_time`,
      [room_id, new Date(start_time), new Date(end_time)]
    );

    res.json({ available: parseInt(result.rows[0].count) === 0 });
  } catch (error) {
    console.error('Error checking booking availability:', error);
    res.status(500).json({ error: 'Failed to check booking availability' });
  }
});

// API route to delete a booking - now uses authentication middleware
app.delete('/api/bookings/:id', canDeleteBooking, async (req, res) => {
  const bookingId = req.params.id;

  try {
    // The canDeleteBooking middleware has already checked if the booking exists
    // and if the user has permission to delete it

    // Delete the booking
    await pool.query(
      'DELETE FROM bookings WHERE id = $1',
      [bookingId]
    );

    res.status(200).json({ success: true, message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// Add a health check endpoint for Railway
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// All other routes should serve the frontend in production
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Add after app initialization but before starting the server
// Run migrations on startup (only in non-production environment or first deploy)
if (process.env.RAILWAY_ENVIRONMENT === 'production') {
  console.log('Attempting to run migrations...');
  try {
    await runMigration();
    console.log('Migrations completed successfully');
  } catch (err) {
    console.error('Error running migrations:', err.message);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});