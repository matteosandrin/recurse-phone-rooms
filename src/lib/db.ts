import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  user: import.meta.env.VITE_DB_USER,
  host: import.meta.env.VITE_DB_HOST,
  database: import.meta.env.VITE_DB_NAME,
  password: import.meta.env.VITE_DB_PASSWORD,
  port: parseInt(import.meta.env.VITE_DB_PORT || '5432'),
  ssl: import.meta.env.VITE_DB_SSL === 'true'
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
};