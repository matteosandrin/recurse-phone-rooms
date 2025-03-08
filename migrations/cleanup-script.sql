-- First, let's see how many duplicate rooms we have
SELECT name, COUNT(*) as count
FROM rooms
GROUP BY name
HAVING COUNT(*) > 1;

-- Add a unique constraint to the name column (if it doesn't exist)
DO $$
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.conname = 'rooms_name_key'
    AND n.nspname = 'public'
  ) THEN
    -- Add the unique constraint
    ALTER TABLE rooms ADD CONSTRAINT rooms_name_key UNIQUE (name);
    RAISE NOTICE 'Added unique constraint on rooms.name';
  ELSE
    RAISE NOTICE 'Unique constraint on rooms.name already exists';
  END IF;
END $$;

-- Clean up duplicate rooms (keep only the ones with the lowest IDs)
WITH unique_rooms AS (
  SELECT MIN(id) as id, name
  FROM rooms
  GROUP BY name
)
DELETE FROM rooms
WHERE id NOT IN (SELECT id FROM unique_rooms)
RETURNING id, name;

-- Verify that we only have unique room names now
SELECT name, COUNT(*) as count
FROM rooms
GROUP BY name
HAVING COUNT(*) > 1;