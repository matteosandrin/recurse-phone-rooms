// API configuration for different environments

// Determine if we're in production by checking the host
const isProduction = window.location.hostname !== 'localhost';

// Base API URL based on environment
export const API_BASE_URL = isProduction
    ? 'https://recurse-bookings-production.up.railway.app/api'
    : 'http://localhost:3000/api';

// Auth endpoints
export const AUTH_CALLBACK_URL = `${API_BASE_URL}/auth/callback`;

// Bookings endpoints
export const BOOKINGS_URL = `${API_BASE_URL}/bookings`;
export const ROOMS_URL = `${API_BASE_URL}/rooms`;