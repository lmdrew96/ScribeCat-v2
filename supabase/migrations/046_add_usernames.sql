-- Migration: Add username support to user profiles
-- Description: Adds username field with validation, uniqueness constraints, and search optimization

-- ============================================================================
-- STEP 1: Add username column (nullable initially for existing users)
-- ============================================================================

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS username TEXT;

-- ============================================================================
-- STEP 2: Create reserved usernames table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reserved_usernames (
  username TEXT PRIMARY KEY,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Populate with common reserved usernames
INSERT INTO public.reserved_usernames (username, reason) VALUES
  ('admin', 'System reserved'),
  ('administrator', 'System reserved'),
  ('support', 'System reserved'),
  ('help', 'System reserved'),
  ('scribecat', 'Brand reserved'),
  ('official', 'System reserved'),
  ('system', 'System reserved'),
  ('root', 'System reserved'),
  ('moderator', 'System reserved'),
  ('mod', 'System reserved'),
  ('staff', 'System reserved'),
  ('team', 'System reserved'),
  ('api', 'System reserved'),
  ('bot', 'System reserved'),
  ('null', 'System reserved'),
  ('undefined', 'System reserved'),
  ('anonymous', 'System reserved'),
  ('guest', 'System reserved'),
  ('user', 'System reserved'),
  ('test', 'System reserved')
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- STEP 3: Create validation function for username format
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_valid_username(username TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check format: alphanumeric, underscore, hyphen only, 3-20 characters
  -- Must start with alphanumeric, cannot be all numbers
  RETURN username ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{2,19}$'
    AND username !~ '^\d+$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- STEP 4: Create function to check if username is available
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_username_available(check_username TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  username_lower TEXT;
BEGIN
  username_lower := LOWER(check_username);

  -- Check if reserved
  IF EXISTS (SELECT 1 FROM public.reserved_usernames WHERE LOWER(username) = username_lower) THEN
    RETURN FALSE;
  END IF;

  -- Check if already taken (case-insensitive)
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE LOWER(username) = username_lower) THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: Add username constraints (after existing users migrate)
-- ============================================================================

-- Add check constraint for format validation
ALTER TABLE public.user_profiles
ADD CONSTRAINT username_format_check
CHECK (username IS NULL OR is_valid_username(username));

-- Create unique index on lowercase username for case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username_lower
ON public.user_profiles (LOWER(username))
WHERE username IS NOT NULL;

-- Create regular index for search performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_username
ON public.user_profiles (username)
WHERE username IS NOT NULL;

-- ============================================================================
-- STEP 6: Update handle_new_user trigger to include username
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'username'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 7: Update profile sync trigger to include username
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_user_profile_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update user_profiles when auth.users metadata changes
  UPDATE public.user_profiles
  SET
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    username = COALESCE(NEW.raw_user_meta_data->>'username', OLD.raw_user_meta_data->>'username'),
    avatar_url = NEW.raw_user_meta_data->>'avatar_url',
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 8: Grant necessary permissions
-- ============================================================================

-- Allow authenticated users to check username availability
GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO authenticated;

-- Allow authenticated users to validate username format
GRANT EXECUTE ON FUNCTION public.is_valid_username(TEXT) TO authenticated;

-- ============================================================================
-- STEP 9: Add RLS policy for username updates
-- ============================================================================

-- Users can update their own username
-- (Existing RLS policies on user_profiles already cover general updates)

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.user_profiles.username IS 'Unique username for user identification (alphanumeric, underscore, hyphen, 3-20 chars, case-insensitive unique)';
COMMENT ON TABLE public.reserved_usernames IS 'List of usernames that cannot be registered by users';
COMMENT ON FUNCTION public.is_valid_username(TEXT) IS 'Validates username format: alphanumeric start, 3-20 chars, alphanumeric/underscore/hyphen only';
COMMENT ON FUNCTION public.is_username_available(TEXT) IS 'Check if username is available (not reserved and not taken, case-insensitive)';
