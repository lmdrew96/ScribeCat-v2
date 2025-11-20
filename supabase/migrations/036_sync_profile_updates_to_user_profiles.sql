-- Sync profile updates from auth.users to user_profiles
-- This ensures that when a user updates their profile (full_name) via auth.updateUser(),
-- the change propagates to the user_profiles table where study rooms and friends read from.

-- Function to sync profile updates from auth.users to user_profiles
CREATE OR REPLACE FUNCTION public.handle_user_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if raw_user_meta_data actually changed
  IF OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data THEN
    UPDATE public.user_profiles
    SET
      full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
      avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
      updated_at = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync profile updates when auth.users metadata changes
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_profile_update();
