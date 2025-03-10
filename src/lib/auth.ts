/// <reference types="vite/client" />

import { writable } from 'svelte/store';
import { db } from './db';
import { OAUTH_REDIRECT_URI } from './apiConfig';

// Define user type
export interface User {
  id: string;
  email: string;
  name: string;
  recurseId: number;
  accessToken: string;
}

// Create a writable store for the user
export const user = writable<User | null>(null);

// Check if user is logged in on load
const userJson = localStorage.getItem('recurse_user');
if (userJson) {
  try {
    user.set(JSON.parse(userJson));
  } catch (err) {
    localStorage.removeItem('recurse_user');
  }
}

// Redirect to Recurse OAuth
export function initiateOAuthLogin() {
  const clientId = import.meta.env.VITE_RECURSE_CLIENT_ID;
  const redirectUri = encodeURIComponent(import.meta.env.VITE_OAUTH_REDIRECT_URI);

  console.log('OAuth login initiated with redirect URI:', import.meta.env.VITE_OAUTH_REDIRECT_URI);

  // According to Recurse API docs, no scope parameter is needed
  window.location.href = `https://www.recurse.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
}

// Handle OAuth callback
export async function handleOAuthCallback(code: string) {
  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://www.recurse.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: import.meta.env.VITE_RECURSE_CLIENT_ID,
        client_secret: import.meta.env.VITE_RECURSE_CLIENT_SECRET,
        redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
        code,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(`OAuth error: ${tokenData.error}`);
    }

    // Get user info
    const userResponse = await fetch('https://www.recurse.com/api/v1/profiles/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    const userData = await userResponse.json();

    // Create or update user in our database
    const dbResult = await db.query(
      `INSERT INTO users (recurse_id, email, name, access_token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (recurse_id) DO UPDATE
       SET email = $2, name = $3, access_token = $4
       RETURNING id, recurse_id, email, name`,
      [userData.id, userData.email, userData.name, tokenData.access_token]
    );

    const dbUser = dbResult.rows[0];

    // Store user in local storage and set in store
    const userToStore = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      recurseId: dbUser.recurse_id,
      accessToken: tokenData.access_token
    };

    localStorage.setItem('recurse_user', JSON.stringify(userToStore));
    user.set(userToStore);

    return userToStore;
  } catch (error) {
    console.error('OAuth error:', error);
    throw error;
  }
}

export function signOut() {
  localStorage.removeItem('recurse_user');
  user.set(null);
}