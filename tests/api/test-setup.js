// Test setup script for API tests

import axios from 'axios';

// Get the API port from the environment or use the default
const API_PORT = process.env.PORT || 3000;
const API_BASE_URL = `http://localhost:${API_PORT}/api`;

// Test user data
export const USERS = {
  ALICE: {
    id: 1, // Note: Using numbers, not strings, to match database expectations
    name: 'Alice Tester',
    email: 'alice@example.com',
    recurse_id: 12345
  },
  BOB: {
    id: 2,
    name: 'Bob Reviewer',
    email: 'bob@example.com',
    recurse_id: 67890
  }
};

/**
 * Ensure the test users exist in the database
 * This uses direct SQL queries through our API
 */
export async function setupTestUsers() {
  console.log('Setting up test users...');

  try {
    // We'll use a special endpoint to ensure our test users exist
    // First, add a simple endpoint to server/index.js for test user setup

    // For now, let's try to directly insert the users using SQL
    // This assumes there's a route like /api/test/setup-users
    await axios.post(`${API_BASE_URL}/test/setup-users`, {
      users: Object.values(USERS)
    }).catch(error => {
      // If the endpoint doesn't exist yet, log the error but continue
      // We'll need to add it to server/index.js
      console.warn('Test setup endpoint not available:', error.message);
      console.warn('Please add the test setup endpoint to server/index.js');
    });

    console.log('Test users setup completed');
  } catch (error) {
    console.error('Error setting up test users:', error.message);
  }
}

/**
 * Helper for making authenticated requests
 * Uses cookie-based authentication by first logging in the user
 */
export async function authRequest(userId) {
  // Create an Axios instance that maintains cookies across requests
  const instance = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true
  });

  // Find the user data
  const user = Object.values(USERS).find(user => user.id === userId);
  if (!user) {
    throw new Error(`User with ID ${userId} not found in test users`);
  }

  // Log the user in to get the auth cookie
  try {
    await instance.post('/auth/test-login', {
      email: user.email,
      // No password needed for test login
    });

    return instance;
  } catch (error) {
    console.error(`Error logging in test user ${user.email}:`, error.message);
    throw error;
  }
}

// Export the API base URL
export { API_BASE_URL };