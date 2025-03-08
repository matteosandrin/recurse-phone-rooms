// Load environment variables from .env file
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3000;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure CORS to allow requests from our frontend
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://recurse-bookings-production.up.railway.app'
  ],
  credentials: true
}));

// Parse JSON request bodies
app.use(express.json());

// Database connection
const pool = new Pool({
  user: process.env.VITE_DB_USER,
  host: process.env.VITE_DB_HOST,
  database: process.env.VITE_DB_NAME,
  password: process.env.VITE_DB_PASSWORD,
  port: parseInt(process.env.VITE_DB_PORT || '5432'),
  ssl: { rejectUnauthorized: false } // This works with Railway PostgreSQL
});

// Test the connection and log detailed info
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.message);
    console.error('Connection details:', {
      host: process.env.VITE_DB_HOST,
      database: process.env.VITE_DB_NAME,
      port: process.env.VITE_DB_PORT,
      error: err.stack
    });
  } else {
    console.log('Database connected successfully:', res.rows[0].now);
  }
});

// Serve static files from the dist directory in production
app.use(express.static(path.join(__dirname, '../dist')));

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
    console.log('Processing authorization code:', code.substring(0, 5) + '...');

    // Exchange authorization code for access token
    let tokenResponse;
    try {
      console.log('Attempting to exchange code for token with Recurse Center API');
      tokenResponse = await axios.post('https://www.recurse.com/oauth/token', {
        client_id: process.env.VITE_RECURSE_CLIENT_ID,
        client_secret: process.env.VITE_RECURSE_CLIENT_SECRET,
        redirect_uri: process.env.VITE_OAUTH_REDIRECT_URI,
        code,
        grant_type: 'authorization_code'
      });
      console.log('Successfully received token response');
    } catch (tokenError) {
      console.error('OAuth token exchange error details:', {
        message: tokenError.message,
        response: tokenError.response?.data,
        status: tokenError.response?.status,
        statusText: tokenError.response?.statusText
      });
      return res.status(401).json({
        error: 'Failed to exchange authorization code for token',
        details: tokenError.response?.data || { error: 'unknown_error' }
      });
    }

    const { access_token } = tokenResponse.data;
    console.log('Successfully obtained access token');

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
      console.error('Error fetching Recurse profile details:', {
        message: profileError.message,
        response: profileError.response?.data,
        status: profileError.response?.status,
        statusText: profileError.response?.statusText
      });
      return res.status(401).json({
        error: 'Failed to fetch user profile from Recurse Center',
        details: profileError.response?.data || { error: 'profile_fetch_error' }
      });
    }

    const userData = userResponse.data;
    console.log('Retrieved user profile for:', userData.email);

    // Create or update user in our database
    try {
      console.log('Attempting to save user to database with recurse_id:', userData.id);
      const dbResult = await pool.query(
        `INSERT INTO users (recurse_id, email, name, access_token)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (recurse_id) DO UPDATE
         SET email = $2, name = $3, access_token = $4
         RETURNING id, recurse_id, email, name`,
        [userData.id, userData.email, userData.name, access_token]
      );

      const dbUser = dbResult.rows[0];
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
      console.error('Database error during user save:', {
        message: dbError.message,
        code: dbError.code,
        detail: dbError.detail,
        stack: dbError.stack
      });
      return res.status(500).json({ error: 'Failed to save user data to database', details: dbError.message });
    }
  } catch (error) {
    console.error('Unhandled OAuth error:', error.message, error.stack);
    res.status(500).json({
      error: 'A server error occurred during authentication',
      details: { error: 'server_error' }
    });
  }
});

// API route to get rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rooms ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// API route to get bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, r.name as room_name, u.email as user_email
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

// API route to create a booking
app.post('/api/bookings', async (req, res) => {
  const { user_id, room_id, start_time, end_time, notes } = req.body;

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
    console.error('Error checking availability:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// Special endpoint for test setup (only available in development mode)
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/test/setup-users', async (req, res) => {
    // ... existing code ...
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});