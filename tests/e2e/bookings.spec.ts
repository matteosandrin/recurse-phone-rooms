import { test, expect } from '@playwright/test';

// Test user credentials
const USER_IDS = {
    STANDARD: '1',
    OTHER: '2'
};

// Define test configurations for different user types
const standardUserTest = test.extend({
    storageState: './tests/storage-state/standard-user.json',
});

const otherUserTest = test.extend({
    storageState: './tests/storage-state/other-user.json',
});

test.describe('Booking Management Tests', () => {
    // Basic calendar loading test to verify the test setup
    standardUserTest('should load the calendar correctly', async ({ page }) => {
        await page.goto('/');

        // Verify calendar components are visible
        await expect(page.locator('.calendar-grid')).toBeVisible();
        await expect(page.locator('.day-column')).toHaveCount(7); // 7 days in the week view

        // Verify day headers are present
        await expect(page.locator('.day-header')).toHaveCount(7);

        // Verify user is logged in by checking for sign out button
        await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();
    });

    standardUserTest('should create a new booking successfully', async ({ page }) => {
        await page.goto('/');

        // Click on a time slot to create a booking (e.g., tomorrow at 10:00 AM)
        // Find a time cell in the first available day column
        const timeCell = await page.locator('.day-column').first().locator('.time-cell[data-hour="10"][data-minute="0"]');
        await timeCell.click();

        // Booking form should appear
        await expect(page.locator('.booking-modal-content')).toBeVisible();

        // Select a room
        await page.locator('button', { hasText: 'Green Phone Room' }).click();

        // Add booking notes
        await page.locator('textarea[placeholder="Add description"]').fill('Test booking via E2E test');

        // Submit the booking
        await page.getByRole('button', { name: 'Book Room' }).click();

        // Expect success message
        await expect(page.locator('text=Meeting scheduled')).toBeVisible();

        // Verify booking appears in the calendar
        await page.waitForSelector('.booking-display:has-text("Test booking via E2E test")');

        // Verify the booking has correct styling (green for Green Phone Room)
        const bookingElement = await page.locator('.booking-display:has-text("Test booking via E2E test")');
        const backgroundColor = await bookingElement.evaluate(el => {
            return window.getComputedStyle(el).backgroundColor;
        });

        // The color should be green (this check may need adjustment based on actual color values)
        expect(backgroundColor).toContain('rgb(22, 163, 74)'); // #16a34a in RGB
    });

    standardUserTest('should prevent double-booking on the same room', async ({ page }) => {
        await page.goto('/');

        // First, create a booking at a specific time
        const timeCell = await page.locator('.day-column').first().locator('.time-cell[data-hour="11"][data-minute="0"]');
        await timeCell.click();

        // Select Green Phone Room
        await page.locator('button', { hasText: 'Green Phone Room' }).click();

        // Add booking notes
        await page.locator('textarea[placeholder="Add description"]').fill('First booking');

        // Submit the booking
        await page.getByRole('button', { name: 'Book Room' }).click();

        // Wait for success and modal to close
        await expect(page.locator('text=Meeting scheduled')).toBeVisible();
        await page.waitForSelector('.booking-modal-content', { state: 'hidden' });

        // Now try to book the same slot again
        await timeCell.click();

        // Select the same room
        await page.locator('button', { hasText: 'Green Phone Room' }).click();

        // Add different notes
        await page.locator('textarea[placeholder="Add description"]').fill('Overlapping booking');

        // Submit the booking
        await page.getByRole('button', { name: 'Book Room' }).click();

        // Should see an error message about slot being unavailable
        await expect(page.locator('text=This time slot is already booked')).toBeVisible();
    });

    standardUserTest('should allow user to delete their own booking', async ({ page }) => {
        await page.goto('/');

        // First, create a booking
        const timeCell = await page.locator('.day-column').first().locator('.time-cell[data-hour="14"][data-minute="0"]');
        await timeCell.click();

        // Select a room
        await page.locator('button', { hasText: 'Green Phone Room' }).click();

        // Add unique booking notes to identify it
        await page.locator('textarea[placeholder="Add description"]').fill('Booking to delete');

        // Submit the booking
        await page.getByRole('button', { name: 'Book Room' }).click();

        // Wait for success and modal to close
        await expect(page.locator('text=Meeting scheduled')).toBeVisible();
        await page.waitForSelector('.booking-modal-content', { state: 'hidden' });

        // Refresh page to make sure we're seeing the latest data
        await page.reload();
        await page.waitForSelector('.calendar-grid');

        // Find and click on our booking to open details
        await page.locator('.booking-display:has-text("Booking to delete")').click();

        // Verify booking details modal is shown
        await expect(page.locator('text=Booking Details')).toBeVisible();

        // Click delete button
        await page.locator('button', { hasText: 'Delete Booking' }).click();

        // Verify booking is no longer visible
        await expect(page.locator('.booking-display:has-text("Booking to delete")')).toHaveCount(0);
    });

    // This test involves creating a booking as one user, then switching to another user to verify permissions
    test('should not allow deleting another user\'s booking', async ({ browser }) => {
        // First create a context for the standard user
        const standardContext = await browser.newContext({
            storageState: './tests/storage-state/standard-user.json'
        });
        const standardPage = await standardContext.newPage();

        await standardPage.goto('/');

        // First, create a booking as the standard user
        const timeCell = await standardPage.locator('.day-column').first().locator('.time-cell[data-hour="15"][data-minute="0"]');
        await timeCell.click();

        // Select a room
        await standardPage.locator('button', { hasText: 'Lovelace' }).click();

        // Add unique booking notes
        await standardPage.locator('textarea[placeholder="Add description"]').fill('Standard user booking');

        // Submit the booking
        await standardPage.getByRole('button', { name: 'Book Room' }).click();

        // Wait for success and modal to close
        await expect(standardPage.locator('text=Meeting scheduled')).toBeVisible();
        await standardPage.waitForSelector('.booking-modal-content', { state: 'hidden' });

        // Close this context
        await standardContext.close();

        // Now create a new context for the other user
        const otherContext = await browser.newContext({
            storageState: './tests/storage-state/other-user.json'
        });
        const otherPage = await otherContext.newPage();

        await otherPage.goto('/');
        await otherPage.waitForSelector('.calendar-grid');

        // Find and click on the booking created by the standard user
        await otherPage.locator('.booking-display:has-text("Standard user booking")').click();

        // Verify booking details modal is shown
        await expect(otherPage.locator('text=Booking Details')).toBeVisible();

        // Verify that there is no Delete button for this booking (not the owner)
        await expect(otherPage.locator('button', { hasText: 'Delete Booking' })).toHaveCount(0);

        // Clean up
        await otherContext.close();
    });
});