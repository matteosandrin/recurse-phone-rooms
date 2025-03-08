# End-to-End Testing for Booking System

This directory contains end-to-end tests for the Recurse Booking System, implemented using Playwright.

## Test Coverage

The tests cover the following scenarios:

1. **Booking Creation** - Verify that users can create bookings in available time slots
2. **Double-booking Prevention** - Verify that users cannot book a room that's already booked for the same time slot
3. **Booking Deletion** - Verify that users can delete their own bookings
4. **Permission Checking** - Verify that users cannot delete bookings created by other users

## Setup

Before running the tests, make sure you have installed the dependencies:

```bash
npm install
```

## Running the Tests

To run all the tests:

```bash
npm test
```

To run the tests with a visible browser (headed mode):

```bash
npm run test:headed
```

To run the tests with Playwright's UI mode (for debugging and development):

```bash
npm run test:ui
```

## Test Structure

- `auth.setup.ts` - Sets up authentication states for different test users
- `bookings.spec.ts` - Contains the main booking-related tests
- `storage-state/` - Directory containing saved authentication states

## Notes on Test Strategy

These tests use a simplified approach to authentication:

1. We bypass the OAuth flow by directly setting user data in localStorage
2. We create saved auth states to make tests faster and more reliable
3. We generate a unique booking for each test to avoid test interference

In a real-world scenario, you might want to:

1. Clean up test data after each test run
2. Set up a test database with known state before testing
3. Consider mocking the API calls for more predictable test behavior