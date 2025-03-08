// Simple Authentication Middleware for the Booking API
// This is a minimal implementation for testing purposes only

import pool from './db.js';

// Middleware to check if a user can delete a booking
export async function canDeleteBooking(req, res, next) {
  // In a real-world application, we would verify the user's identity from a JWT token
  // For our testing purposes, we'll use a custom header
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const bookingId = req.params.id;

  if (!bookingId) {
    return res.status(400).json({ error: 'Booking ID is required' });
  }

  try {
    // Check if the booking exists and belongs to the user
    const result = await pool.query(
      'SELECT * FROM bookings WHERE id = $1',
      [bookingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = result.rows[0];

    // Check if the user owns this booking or is an admin
    if (booking.user_id !== parseInt(userId)) {
      return res.status(403).json({
        error: 'You are not authorized to delete this booking'
      });
    }

    // User is authorized to delete this booking
    next();
  } catch (error) {
    console.error('Error in canDeleteBooking middleware:', error);
    res.status(500).json({ error: 'Server error checking booking permissions' });
  }
}

// Mock middleware to simulate authentication
// In a real application, this would validate tokens
export function authenticate(req, res, next) {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Add the userId to the request object for use in route handlers
  req.userId = parseInt(userId);

  next();
}