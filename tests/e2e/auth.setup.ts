import { test as setup, expect } from '@playwright/test';

// This file provides authentication setup for our tests
// It creates a reusable authenticated state that other tests can use

// Test user state
const mockUsers = {
    standard: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        recurseId: 12345,
        accessToken: 'mock-token',
    },
    other: {
        id: '2',
        email: 'other@example.com',
        name: 'Other User',
        recurseId: 67890,
        accessToken: 'other-mock-token',
    }
};

// Setup authentication for standard user
setup('authenticate as standard user', async ({ page }) => {
    // Go to the application
    await page.goto('/');

    // Set the user in localStorage to simulate a successful login
    await page.evaluate((user) => {
        localStorage.setItem('recurse_user', JSON.stringify(user));
        // Force a reload to apply the user data
        window.location.href = '/';
    }, mockUsers.standard);

    // Wait for the page to reload and calendar to display
    await page.waitForSelector('.calendar-grid');

    // Save the authenticated state for future use in tests
    await page.context().storageState({ path: './tests/storage-state/standard-user.json' });
});

// Setup authentication for other user
setup('authenticate as other user', async ({ page }) => {
    // Go to the application
    await page.goto('/');

    // Set the user in localStorage to simulate a successful login
    await page.evaluate((user) => {
        localStorage.setItem('recurse_user', JSON.stringify(user));
        // Force a reload to apply the user data
        window.location.href = '/';
    }, mockUsers.other);

    // Wait for the page to reload and calendar to display
    await page.waitForSelector('.calendar-grid');

    // Save the authenticated state for future use in tests
    await page.context().storageState({ path: './tests/storage-state/other-user.json' });
});