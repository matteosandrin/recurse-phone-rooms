-- Migration to clean up duplicate rooms
-- This ensures we keep only one record per room name (the one with the lowest ID)

-- First, get a list of all unique room names with their lowest ID
WITH unique_rooms AS (
  SELECT MIN(id) as id, name
  FROM rooms
  GROUP BY name
)
-- Then delete all rooms that are not in the list of rooms with the lowest ID for each name
DELETE FROM rooms
WHERE id NOT IN (SELECT id FROM unique_rooms);

-- Log that this migration was run
DO $$
BEGIN
  RAISE NOTICE 'Migration 002: Duplicate rooms cleanup completed';
END $$;