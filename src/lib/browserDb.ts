// This file provides a browser-compatible API for database operations via our backend API

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
}

export class DatabaseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DatabaseError';
    }
}

// API base URL
const API_BASE = 'http://localhost:3000/api';

export const db = {
    // Get all rooms
    async getRooms(): Promise<Room[]> {
        try {
            const response = await fetch(`${API_BASE}/rooms`);

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
            const response = await fetch(`${API_BASE}/bookings`);

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
            const response = await fetch(`${API_BASE}/bookings?user_id=${userId}`);

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
            const response = await fetch(`${API_BASE}/bookings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(booking)
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
            const response = await fetch(`${API_BASE}/bookings/${id}`, {
                method: 'DELETE',
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
                `${API_BASE}/bookings/check-availability?room_id=${roomId}&start_time=${startTime.toISOString()}&end_time=${endTime.toISOString()}`
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