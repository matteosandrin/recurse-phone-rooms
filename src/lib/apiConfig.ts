// API configuration for different environments

// Determine if we're in production by checking the host
const isProduction = window.location.hostname !== 'localhost';

// Get the current hostname
const currentHostname = window.location.hostname;

// Base API URL based on environment
export const API_BASE_URL = isProduction
    ? `https://${currentHostname}/api` // Use current hostname dynamically
    : 'http://localhost:3000/api';

// Auth endpoints
export const AUTH_CALLBACK_URL = `${API_BASE_URL}/auth/callback`;

// Bookings endpoints
export const BOOKINGS_URL = `${API_BASE_URL}/bookings`;
export const ROOMS_URL = `${API_BASE_URL}/rooms`;