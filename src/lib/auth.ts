import { writable } from 'svelte/store';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from './db';

export const user = writable(null);

// Check if user is logged in on load
const token = localStorage.getItem('token');
if (token) {
  try {
    const decoded = jwt.verify(token, import.meta.env.VITE_JWT_SECRET);
    user.set(decoded);
  } catch (err) {
    localStorage.removeItem('token');
  }
}

export async function login(email: string, password: string) {
  try {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    const userData = result.rows[0];
    if (!userData) {
      throw new Error('User not found');
    }

    const validPassword = await bcrypt.compare(password, userData.password);
    if (!validPassword) {
      throw new Error('Invalid password');
    }

    const token = jwt.sign(
      { id: userData.id, email: userData.email },
      import.meta.env.VITE_JWT_SECRET,
      { expiresIn: '24h' }
    );

    localStorage.setItem('token', token);
    user.set({ id: userData.id, email: userData.email });
    return true;
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
}

export async function signOut() {
  localStorage.removeItem('token');
  user.set(null);
}