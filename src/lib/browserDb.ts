// This file provides a browser-compatible API for database operations via our backend API
import { API_BASE_URL, BOOKINGS_URL, ROOMS_URL } from './apiConfig';

export interface Room {
    id: number;
    name: string;
    description: string;
    capacity: number;
    created_at: Date;
    updated_at: Date;
}

export interface Booking {
    id: number;
    user_id: number;
    room_id: number;
    start_time: Date;
    end_time: Date;
    notes?: string;
    created_at: Date;
    updated_at: Date;
    room_name?: string;
    user_email?: string;
    user_name?: string;
}

export class DatabaseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DatabaseError';
    }
}

export const db = {
    // Get all rooms
    async getRooms(): Promise<Room[]> {
        try {
            const response = await fetch(ROOMS_URL, {
                credentials: 'include' // Include cookies for authentication
            });

            if (!response.ok) {
                const error = await response.json();
                throw new DatabaseError(error.error || 'Failed to fetch rooms');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching rooms:', error);
            throw new DatabaseError(error instanceof Error ? error.message : 'Unknown error fetching rooms');
        }
    },

    // Get bookings for calendar view
    async getBookings(): Promise<Booking[]> {
        try {
            const response = await fetch(BOOKINGS_URL, {
                credentials: 'include' // Include cookies for authentication
            });

            if (!response.ok) {
                const error = await response.json();
                throw new DatabaseError(error.error || 'Failed to fetch bookings');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching bookings:', error);
            throw new DatabaseError(error instanceof Error ? error.message : 'Unknown error fetching bookings');
        }
    },

    // Get bookings for a specific user
    async getUserBookings(userId: number): Promise<Booking[]> {
        try {
            const response = await fetch(`${BOOKINGS_URL}?user_id=${userId}`, {
                credentials: 'include' // Include cookies for authentication
            });

            if (!response.ok) {
                const error = await response.json();
                throw new DatabaseError(error.error || 'Failed to fetch user bookings');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching user bookings:', error);
            throw new DatabaseError(error instanceof Error ? error.message : 'Unknown error fetching user bookings');
        }
    },

    // Create a new booking
    async createBooking(booking: Omit<Booking, 'id' | 'created_at' | 'updated_at'>): Promise<Booking> {
        try {
            const response = await fetch(BOOKINGS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(booking),
                credentials: 'include' // Include cookies for authentication
            });

            if (!response.ok) {
                const error = await response.json();
                throw new DatabaseError(error.error || 'Failed to create booking');
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating booking:', error);
            throw new DatabaseError(error instanceof Error ? error.message : 'Unknown error creating booking');
        }
    },

    // Delete a booking
    async deleteBooking(id: number): Promise<void> {
        try {
            // Get current user to verify authentication
            const userStr = localStorage.getItem('recurse_user');
            if (!userStr) {
                throw new DatabaseError('Not authenticated');
            }

            const response = await fetch(`${BOOKINGS_URL}/${id}`, {
                method: 'DELETE',
                credentials: 'include', // Include cookies for authentication
            });

            if (!response.ok) {
                const error = await response.json();
                throw new DatabaseError(error.error || 'Failed to delete booking');
            }
        } catch (error) {
            console.error('Error deleting booking:', error);
            throw new DatabaseError(error instanceof Error ? error.message : 'Unknown error deleting booking');
        }
    },

    // Check if a time slot is available for a room
    async isTimeSlotAvailable(roomId: number, startTime: Date, endTime: Date): Promise<boolean> {
        try {
            const response = await fetch(
                `${BOOKINGS_URL}/check-availability?room_id=${roomId}&start_time=${startTime.toISOString()}&end_time=${endTime.toISOString()}`,
                {
                    credentials: 'include' // Include cookies for authentication
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new DatabaseError(error.error || 'Failed to check availability');
            }

            const result = await response.json();
            return result.available;
        } catch (error) {
            console.error('Error checking availability:', error);
            throw new DatabaseError(error instanceof Error ? error.message : 'Unknown error checking availability');
        }
    }
};