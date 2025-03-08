// Use CommonJS imports since this is a standalone script
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const { Pool } = pg;

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a connection pool
const pool = new Pool({
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

export async function runMigration() {
  // Get the migration file
  const sqlFile = path.join(__dirname, 'init.sql');
  const sql = await fs.promises.readFile(sqlFile, 'utf8');

  // Get a client from the pool
  const client = await pool.connect();

  try {
    // Start a transaction
    await client.query('BEGIN');

    // Run the migration
    await client.query(sql);

    // Clean up duplicate rooms if any exist
    const cleanupSql = `
      -- This query removes duplicate rooms keeping only the one with the lowest ID for each room name
      WITH unique_rooms AS (
        SELECT MIN(id) as id, name
        FROM rooms
        GROUP BY name
      )
      DELETE FROM rooms
      WHERE id NOT IN (SELECT id FROM unique_rooms);
    `;
    await client.query(cleanupSql);
    console.log('Room duplicates cleanup completed');

    // Commit the transaction
    await client.query('COMMIT');

    console.log('Migration completed successfully');
    return true;
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    // Release the client back to the pool
    client.release();
  }
}

// Run directly if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigration()
    .then(() => pool.end())
    .catch(err => {
      console.error('Migration script error:', err);
      pool.end();
      process.exit(1);
    });
}