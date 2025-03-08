import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create a PostgreSQL connection pool
const pool = new pg.Pool({
  user: process.env.VITE_DB_USER,
  host: process.env.VITE_DB_HOST,
  database: process.env.VITE_DB_NAME,
  password: process.env.VITE_DB_PASSWORD,
  port: parseInt(process.env.VITE_DB_PORT || '5432'),
  ssl: process.env.VITE_DB_SSL === 'true'
    ? true
    : (process.env.VITE_DB_SSL === 'no-verify'
      ? { rejectUnauthorized: false }
      : false)
});

// Log when the pool is created for debugging
console.log(`DB pool created with host: ${process.env.VITE_DB_HOST}, database: ${process.env.VITE_DB_NAME}`);

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Database connected:', res.rows[0].now);
  }
});

export default pool;