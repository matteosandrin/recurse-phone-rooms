/*
  # Room Booking System Schema

  1. New Tables
    - `rooms`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `capacity` (integer)
      - `created_at` (timestamp)
    
    - `bookings`
      - `id` (uuid, primary key)
      - `room_id` (uuid, foreign key to rooms)
      - `user_id` (uuid, foreign key to auth.users)
      - `start_time` (timestamp)
      - `end_time` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Policies for rooms:
      - Anyone can view rooms
      - Only authenticated users can create/update/delete rooms
    - Policies for bookings:
      - Authenticated users can view all bookings
      - Users can only create/update/delete their own bookings
*/

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  capacity integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_booking_time CHECK (end_time > start_time),
  CONSTRAINT no_overlapping_bookings UNIQUE (room_id, start_time, end_time)
);

-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Policies for rooms
CREATE POLICY "Anyone can view rooms"
  ON rooms
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage rooms"
  ON rooms
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for bookings
CREATE POLICY "Authenticated users can view all bookings"
  ON bookings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own bookings"
  ON bookings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());