import { test, expect } from '@playwright/test';
import axios from 'axios';
import { API_BASE_URL, USERS, authRequest, setupTestUsers } from './test-setup.js';

// We'll use these for test fixtures across tests
let testRoomId = null;
let aliceBookingId = null;
let bobBookingId = null;

test.describe('Booking API Tests', () => {
  // Setup: Make sure server is running before tests
  // and ensure test users exist in the database
  test.beforeAll(async () => {
    try {
      // Check if the server is running
      await axios.get(`${API_BASE_URL}/rooms`);
      console.log('Server is running and API is accessible');

      // Set up test users
      await setupTestUsers();
    } catch (error) {
      console.error('ERROR: API server is not running or setup failed');
      throw new Error(`API server must be running for these tests: ${error.message}`);
    }
  });

  // Setup: Get a room ID we can use in all tests
  test.beforeAll(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/rooms`);
      if (response.data.length > 0) {
        testRoomId = response.data[0].id;
        console.log(`Using room ID ${testRoomId} for tests`);
      } else {
        throw new Error('No rooms found in the database');
      }
    } catch (error) {
      console.error('Error getting rooms:', error.message);
      throw error;
    }
  });

  // Cleanup: Delete any test bookings after all tests
  test.afterAll(async () => {
    // Clean up any bookings we created
    try {
      if (aliceBookingId) {
        await authRequest(USERS.ALICE.id).delete(`/bookings/${aliceBookingId}`).catch(() => { });
        console.log('Cleaned up Alice\'s booking');
      }
      if (bobBookingId) {
        await authRequest(USERS.BOB.id).delete(`/bookings/${bobBookingId}`).catch(() => { });
        console.log('Cleaned up Bob\'s booking');
      }
    } catch (error) {
      console.error('Error during cleanup:', error.message);
    }
  });

  test('should get all rooms', async ({ page }) => {
    // Public endpoint, no auth needed
    const response = await axios.get(`${API_BASE_URL}/rooms`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.length).toBeGreaterThan(0);

    // Verify room structure
    const room = response.data[0];
    expect(room).toHaveProperty('id');
    expect(room).toHaveProperty('name');
  });

  test('should get all bookings', async ({ page }) => {
    // Public endpoint, but in a real app this would be authenticated
    const response = await axios.get(`${API_BASE_URL}/bookings`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);

    // Bookings might be empty initially, but the array should exist
    if (response.data.length > 0) {
      const booking = response.data[0];
      expect(booking).toHaveProperty('id');
      expect(booking).toHaveProperty('user_id');
      expect(booking).toHaveProperty('room_id');
      expect(booking).toHaveProperty('start_time');
      expect(booking).toHaveProperty('end_time');
    }
  });

  // We'll make each test independent and not rely on other tests creating bookings

  test('should create a booking successfully', async ({ page }) => {
    // Create a booking 1 hour from now for 30 minutes
    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes later

    const bookingData = {
      room_id: testRoomId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      notes: 'API Test: Alice\'s booking',
    };

    // Use Alice's auth
    const aliceClient = authRequest(USERS.ALICE.id);

    try {
      const response = await aliceClient.post(`/bookings`, bookingData);

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.user_id).toBe(USERS.ALICE.id);
      expect(response.data.room_id).toBe(testRoomId);

      // Save the booking ID for cleanup later
      aliceBookingId = response.data.id;
    } catch (error) {
      console.error('Error creating booking:', error.response?.data || error.message);
      throw error;
    }
  });

  test('should check if a time slot is available', async ({ page }) => {
    // Check a time slot 2 hours from now (should be available)
    const now = new Date();
    const startTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes later

    const response = await axios.get(`${API_BASE_URL}/bookings/check-availability`, {
      params: {
        room_id: testRoomId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      }
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('available');
    // The slot should be available since we're checking a future time
    expect(response.data.available).toBe(true);
  });

  test('should not allow double-booking the same room', async ({ page }) => {
    // Create Alice's booking first
    const now = new Date();
    const startTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes later

    const aliceClient = authRequest(USERS.ALICE.id);

    // First create Alice's booking
    const aliceBookingData = {
      room_id: testRoomId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      notes: 'API Test: Alice\'s booking for double-book test',
    };

    let aliceResponse;
    try {
      aliceResponse = await aliceClient.post(`/bookings`, aliceBookingData);
      expect(aliceResponse.status).toBe(201);

      // Save for cleanup
      if (!aliceBookingId) { // Only save if not already set by an earlier test
        aliceBookingId = aliceResponse.data.id;
      }
    } catch (error) {
      console.error('Error creating Alice\'s booking:', error.response?.data || error.message);
      throw error;
    }

    // Now try to create a booking at the same time in the same room as Bob
    const bobBookingData = {
      room_id: testRoomId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      notes: 'API Test: Bob\'s conflicting booking',
    };

    // Use Bob's auth
    const bobClient = authRequest(USERS.BOB.id);

    try {
      await bobClient.post(`/bookings`, bobBookingData);
      // If we get here, the request succeeded, which is wrong
      expect(false).toBe(true, 'Should not allow double booking');
    } catch (error) {
      // Expect a 409 conflict error
      expect(error.response.status).toBe(409);
      expect(error.response.data.error).toContain('already booked');
    }
  });

  test('should allow users to delete their own bookings', async ({ page }) => {
    // Create a booking for Alice first
    const now = new Date();
    const startTime = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours from now
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes later

    const aliceClient = authRequest(USERS.ALICE.id);

    // Create Alice's booking
    let bookingId;
    try {
      const createResponse = await aliceClient.post(`/bookings`, {
        room_id: testRoomId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        notes: 'API Test: Alice\'s booking to delete',
      });

      expect(createResponse.status).toBe(201);
      bookingId = createResponse.data.id;
      console.log(`Created booking ID ${bookingId} for deletion test`);
    } catch (error) {
      console.error('Error creating booking to delete:', error.response?.data || error.message);
      throw error;
    }

    // Verify the booking exists before deleting
    try {
      const bookingsResponse = await aliceClient.get(`/bookings`);
      expect(bookingsResponse.status).toBe(200);

      const bookingExists = bookingsResponse.data.some(b => b.id === bookingId);
      expect(bookingExists).toBe(true, `Booking with ID ${bookingId} should exist before deletion`);
    } catch (error) {
      console.error('Error verifying booking exists:', error.response?.data || error.message);
      throw error;
    }

    // Now delete the booking
    const deleteResponse = await aliceClient.delete(`/bookings/${bookingId}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.data.message).toBe('Booking deleted successfully');

    // Verify the booking no longer exists after deletion
    try {
      const bookingsResponse = await aliceClient.get(`/bookings`);
      expect(bookingsResponse.status).toBe(200);

      const bookingStillExists = bookingsResponse.data.some(b => b.id === bookingId);
      expect(bookingStillExists).toBe(false, `Booking with ID ${bookingId} should not exist after deletion`);
    } catch (error) {
      console.error('Error verifying booking was deleted:', error.response?.data || error.message);
      throw error;
    }
  });

  test('should not allow users to delete bookings that don\'t exist', async ({ page }) => {
    // Try to delete a non-existent booking
    const aliceClient = authRequest(USERS.ALICE.id);

    try {
      await aliceClient.delete(`/bookings/999999`);
      // If we get here, the request succeeded, which is wrong
      expect(false).toBe(true, 'Should not allow deleting non-existent bookings');
    } catch (error) {
      // Expect a 404 not found error
      expect(error.response.status).toBe(404);
      expect(error.response.data.error).toContain('not found');
    }
  });

  test('should not allow deleting another user\'s booking', async ({ page }) => {
    // Create a booking for Bob first
    const now = new Date();
    const startTime = new Date(now.getTime() + 5 * 60 * 60 * 1000); // 5 hours from now
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes later

    const bobClient = authRequest(USERS.BOB.id);

    // Create Bob's booking
    let bobsBookingId;
    try {
      const createResponse = await bobClient.post(`/bookings`, {
        room_id: testRoomId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        notes: 'API Test: Bob\'s booking that Alice cannot delete',
      });

      expect(createResponse.status).toBe(201);
      bobsBookingId = createResponse.data.id;

      // Save for cleanup
      if (!bobBookingId) { // Only save if not already set by an earlier test
        bobBookingId = bobsBookingId;
      }
    } catch (error) {
      console.error('Error creating Bob\'s booking:', error.response?.data || error.message);
      throw error;
    }

    // Now try to delete Bob's booking as Alice (should fail)
    const aliceClient = authRequest(USERS.ALICE.id);

    try {
      await aliceClient.delete(`/bookings/${bobsBookingId}`);
      // If we get here, the request succeeded, which is wrong
      expect(false).toBe(true, 'Should not allow deleting another user\'s booking');
    } catch (error) {
      // Expect a 403 forbidden error
      expect(error.response.status).toBe(403);
      expect(error.response.data.error).toContain('not authorized');
    }
  });
});