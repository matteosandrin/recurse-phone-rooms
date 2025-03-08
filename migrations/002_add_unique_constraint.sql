-- Add unique constraint to room names if it doesn't exist
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
END
$$;