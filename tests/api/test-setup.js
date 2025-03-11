// Test setup script for API tests

import axios from 'axios';

// Get the API port from the environment or use the test server port
const API_PORT = process.env.TEST_PORT || 3001;
const API_BASE_URL = `http://localhost:${API_PORT}/api`;

// Store auth cookies for reuse
const authCookies = new Map();

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
    await axios.post(`${API_BASE_URL}/test/setup-users`, {
      users: Object.values(USERS)
    }).catch(error => {
      // If the endpoint doesn't exist yet, log the error but continue
      console.warn('Test setup endpoint not available:', error.message);
      console.warn('Please add the test setup endpoint to server/index.js');
    });

    // Verify that our test users can authenticate
    try {
      // Test ALICE login to ensure authentication works
      const loginResponse = await axios.post(
        `${API_BASE_URL}/auth/test-login`,
        { email: USERS.ALICE.email },
        { withCredentials: true }
      );

      console.log('Test user authentication verified:', loginResponse.status === 200);

      if (loginResponse.headers['set-cookie']) {
        console.log('Auth cookie successfully set');
        // Store this cookie for later use
        const cookies = loginResponse.headers['set-cookie'];
        authCookies.set(USERS.ALICE.id, cookies);
      } else {
        console.warn('No auth cookie set during test login');
      }
    } catch (authError) {
      console.error('Error testing authentication:', authError.message);
    }

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
  // Find the user data
  const user = Object.values(USERS).find(user => user.id === userId);
  if (!user) {
    throw new Error(`User with ID ${userId} not found in test users`);
  }

  // Create an Axios instance that includes auth in every request
  const instance = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true
  });

  // Log the user in to get the auth cookie
  try {
    // Perform login
    const loginResponse = await axios.post(
      `${API_BASE_URL}/auth/test-login`,
      { email: user.email },
      { withCredentials: true }
    );

    if (loginResponse.status !== 200) {
      throw new Error(`Login failed with status ${loginResponse.status}`);
    }

    // Extract and store the auth cookie
    if (loginResponse.headers['set-cookie']) {
      const cookies = loginResponse.headers['set-cookie'];
      const authCookie = cookies.find(cookie => cookie.startsWith('auth_token='));
      if (authCookie) {
        // Store the auth token value
        const cookieVal = authCookie.split(';')[0];
        console.log(`Auth cookie obtained: ${cookieVal.substring(0, 20)}...`);

        // Set this cookie on all future requests
        instance.interceptors.request.use(config => {
          config.headers.Cookie = cookieVal;
          return config;
        });

        // Store this cookie for reuse
        authCookies.set(userId, cookies);
      } else {
        console.warn('No auth_token found in cookies');
      }
    } else {
      console.warn('No cookies in login response');
    }

    console.log(`${user.name} authenticated successfully`);

    // Return a client object with convenience methods for tests
    return {
      // Standard methods to match tests
      get: (path, config) => instance.get(path, config),
      post: (path, data, config) => instance.post(path, data, config),
      put: (path, data, config) => instance.put(path, data, config),
      delete: (path, config) => instance.delete(path, config),

      // The raw axios instance for advanced usage
      axios: instance
    };
  } catch (error) {
    console.error(`Error logging in test user ${user.email}:`, error.message);
    throw error;
  }
}

// Export the API base URL
export { API_BASE_URL };