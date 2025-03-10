/**
 * Test Server for API Tests
 *
 * This is a modified version of the main server that uses the test database configuration.
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser'; // We need to install this
import pool from './db-test.js'; // Use the test database configuration
import { canDeleteBooking, authenticate, testLogin } from './auth-middleware.js';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Allow frontend to make requests
  credentials: true // Allow cookies to be sent
}));
app.use(express.json());
app.use(cookieParser()); // Parse cookies

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Login endpoint for tests
app.post('/api/auth/test-login', testLogin);

// Add test setup endpoint
app.post('/api/test/setup-users', async (req, res) => {
  const { users } = req.body || { users: [] };

  try {
    for (const user of users) {
      // Check if user exists
      const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [user.id]);

      if (userCheck.rows.length === 0) {
        // Create the user with a test token that's predictable
        await pool.query(
          `INSERT INTO users (id, recurse_id, email, name, access_token)
           VALUES ($1, $2, $3, $4, $5)`,
          [user.id, user.recurse_id, user.email, user.name, `test-token-${user.id}`]
        );
        console.log(`Created test user: ${user.name} (ID: ${user.id})`);
      } else {
        console.log(`Test user already exists: ${user.name} (ID: ${user.id})`);
      }
    }

    res.status(200).json({ message: 'Test users set up successfully' });
  } catch (error) {
    console.error('Error setting up test users:', error);
    res.status(500).json({ error: 'Failed to set up test users' });
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
      JOIN users u ON b.user_id = u.id
      ORDER BY b.start_time
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// API route to get bookings for a specific user
app.get('/api/users/:userId/bookings', authenticate, async (req, res) => {
  const { userId } = req.params;

  // Ensure the user can only access their own bookings
  if (req.user.id !== parseInt(userId)) {
    return res.status(403).json({ error: 'Not authorized to access other users\' bookings' });
  }

  try {
    const result = await pool.query(`
      SELECT b.*, r.name as room_name
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE b.user_id = $1
      ORDER BY b.start_time
    `, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ error: 'Failed to fetch user bookings' });
  }
});

// API route to create a booking
app.post('/api/bookings', authenticate, async (req, res) => {
  const { room_id, start_time, end_time, notes } = req.body;

  // Get user_id from the authenticated user
  const user_id = req.user.id;

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
    const conflictCheck = await pool.query(
      `SELECT COUNT(*) as count
       FROM bookings
       WHERE room_id = $1
       AND $2 < end_time
       AND $3 > start_time`,
      [room_id, start_time, end_time]
    );

    const isAvailable = parseInt(conflictCheck.rows[0].count) === 0;
    res.json({ available: isAvailable });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// API route to delete a booking
app.delete('/api/bookings/:id', canDeleteBooking, async (req, res) => {
  const { id } = req.params;

  try {
    // Delete the booking
    await pool.query('DELETE FROM bookings WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// OAuth callback endpoint
app.post('/api/auth/callback', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    // Simulate successful authentication for tests
    // In a real application, this would exchange the code for a token with Recurse Center

    // Find an existing user or create a new one
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', ['test@example.com']);

    let user;
    if (userCheck.rows.length > 0) {
      user = userCheck.rows[0];
    } else {
      // Create a new test user
      const result = await pool.query(
        `INSERT INTO users (recurse_id, email, name, access_token)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [12345, 'test@example.com', 'Test User', 'test-token-123']
      );
      user = result.rows[0];
    }

    // Set a cookie with the user's access token
    res.cookie('auth_token', user.access_token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      sameSite: 'strict'
    });

    // Return user data
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      recurseId: user.recurse_id
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error });
  }
});

app.listen(port, () => {
  console.log(`Test server running on port ${port}`);
});

// Export the app for testing purposes
export default app;