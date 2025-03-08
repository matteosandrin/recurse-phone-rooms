// Script to update rooms in the database
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

// Database connection
const pool = new Pool({
  user: process.env.VITE_DB_USER,
  host: process.env.VITE_DB_HOST,
  database: process.env.VITE_DB_NAME,
  password: process.env.VITE_DB_PASSWORD,
  port: parseInt(process.env.VITE_DB_PORT || '5432'),
  ssl: process.env.VITE_DB_SSL === 'true'
});

async function updateRooms() {
  const client = await pool.connect();

  try {
    // Begin transaction
    await client.query('BEGIN');

    // Get existing rooms
    const existingRooms = await client.query('SELECT id, name FROM rooms');
    console.log('Existing rooms:', existingRooms.rows);

    // Check if there are existing bookings
    const bookingsCheck = await client.query('SELECT COUNT(*) as count FROM bookings');
    const hasBookings = parseInt(bookingsCheck.rows[0].count) > 0;

    if (hasBookings) {
      // Delete all bookings first if they exist
      await client.query('DELETE FROM bookings');
      console.log('Deleted all existing bookings');
    }

    // Delete all existing rooms
    await client.query('DELETE FROM rooms');
    console.log('Deleted all existing rooms');

    // Insert only the two desired rooms
    const roomsToInsert = [
      { name: 'Green Phone Room', description: 'Small green phone booth for private calls', capacity: 1 },
      { name: 'Lovelace', description: 'Conference room named after Ada Lovelace', capacity: 4 }
    ];

    for (const room of roomsToInsert) {
      await client.query(
        'INSERT INTO rooms (name, description, capacity) VALUES ($1, $2, $3)',
        [room.name, room.description, room.capacity]
      );
    }

    console.log('Inserted new rooms:', roomsToInsert.map(r => r.name).join(', '));

    // Verify the new rooms
    const newRooms = await client.query('SELECT id, name FROM rooms');
    console.log('New rooms in database:', newRooms.rows);

    // Commit transaction
    await client.query('COMMIT');

    console.log('Database updated successfully!');
  } catch (error) {
    // Rollback transaction in case of error
    await client.query('ROLLBACK');
    console.error('Error updating rooms:', error);
  } finally {
    // Release client
    client.release();
    // Close pool
    pool.end();
  }
}

// Run the update
updateRooms();