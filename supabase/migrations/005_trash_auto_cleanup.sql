-- Phase 5: Trash System with Auto-Cleanup
-- This migration adds automatic cleanup for sessions in trash after 30 days
-- and RLS policies to allow users to view their deleted sessions

-- ============================================================================
-- 1. ENABLE PG_CRON EXTENSION
-- ============================================================================
-- Enable the pg_cron extension for scheduling tasks
-- Note: pg_cron must be enabled at the database level by a superuser
-- If using Supabase, this may require dashboard configuration
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- 2. RLS POLICY FOR VIEWING DELETED SESSIONS
-- ============================================================================
-- Allow users to view their own deleted sessions (for trash view)
-- This policy works alongside the existing policy that filters out deleted sessions

CREATE POLICY "Users can view their deleted sessions"
  ON public.sessions
  FOR SELECT
  USING (
    auth.uid() = user_id
    AND deleted_at IS NOT NULL
  );

-- ============================================================================
-- 3. CLEANUP FUNCTION
-- ============================================================================
-- Function to permanently delete sessions that have been in trash for > 30 days
-- This removes:
-- - Audio files metadata (actual audio files in storage need separate cleanup)
-- - Session versions
-- - Session records
-- Note: Exported files are NOT deleted (by design)

CREATE OR REPLACE FUNCTION public.cleanup_old_trashed_sessions()
RETURNS TABLE (
  deleted_sessions_count INTEGER,
  deleted_audio_files_count INTEGER,
  deleted_versions_count INTEGER
) AS $$
DECLARE
  sessions_count INTEGER := 0;
  audio_count INTEGER := 0;
  versions_count INTEGER := 0;
  cutoff_date TIMESTAMPTZ;
BEGIN
  -- Calculate the cutoff date (30 days ago)
  cutoff_date := NOW() - INTERVAL '30 days';

  -- Log the cleanup operation
  RAISE NOTICE 'Starting cleanup of sessions deleted before: %', cutoff_date;

  -- Delete related audio_files records for old trashed sessions
  -- (if audio_files table exists and has session_id foreign key)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audio_files'
  ) THEN
    DELETE FROM public.audio_files
    WHERE session_id IN (
      SELECT id FROM public.sessions
      WHERE deleted_at IS NOT NULL
      AND deleted_at < cutoff_date
    );
    GET DIAGNOSTICS audio_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % audio_files records', audio_count;
  END IF;

  -- Delete related session_versions records for old trashed sessions
  -- (if session_versions table exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'session_versions'
  ) THEN
    DELETE FROM public.session_versions
    WHERE session_id IN (
      SELECT id FROM public.sessions
      WHERE deleted_at IS NOT NULL
      AND deleted_at < cutoff_date
    );
    GET DIAGNOSTICS versions_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % session_versions records', versions_count;
  END IF;

  -- Permanently delete the sessions
  DELETE FROM public.sessions
  WHERE deleted_at IS NOT NULL
  AND deleted_at < cutoff_date;
  GET DIAGNOSTICS sessions_count = ROW_COUNT;
  RAISE NOTICE 'Permanently deleted % sessions', sessions_count;

  -- Return counts
  deleted_sessions_count := sessions_count;
  deleted_audio_files_count := audio_count;
  deleted_versions_count := versions_count;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. SCHEDULE DAILY CLEANUP
-- ============================================================================
-- Schedule the cleanup function to run daily at 2:00 AM UTC
-- The cron schedule uses standard cron syntax: minute hour day month day-of-week

SELECT cron.schedule(
  'cleanup-old-trashed-sessions',  -- Job name
  '0 2 * * *',                      -- Run at 2:00 AM every day
  $$SELECT public.cleanup_old_trashed_sessions();$$  -- SQL to execute
);

-- ============================================================================
-- 5. FUNCTION TO CHECK SESSIONS EXPIRING SOON
-- ============================================================================
-- Helper function to find sessions that will be auto-deleted soon (within N days)
-- This can be used by the application to warn users

CREATE OR REPLACE FUNCTION public.get_sessions_expiring_soon(
  user_id_param UUID,
  days_threshold INTEGER DEFAULT 7
)
RETURNS TABLE (
  session_id UUID,
  title TEXT,
  deleted_at TIMESTAMPTZ,
  days_until_deletion INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.title,
    s.deleted_at,
    30 - EXTRACT(DAY FROM (NOW() - s.deleted_at))::INTEGER AS days_until_deletion
  FROM public.sessions s
  WHERE s.user_id = user_id_param
    AND s.deleted_at IS NOT NULL
    AND s.deleted_at > NOW() - INTERVAL '30 days'
    AND s.deleted_at < NOW() - INTERVAL '23 days'  -- Within 7 days of deletion
  ORDER BY s.deleted_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ BEGIN
    RAISE NOTICE '✓ Trash auto-cleanup system configured successfully!';
    RAISE NOTICE '  - pg_cron extension enabled';
    RAISE NOTICE '  - RLS policy added for viewing deleted sessions';
    RAISE NOTICE '  - cleanup_old_trashed_sessions() function created';
    RAISE NOTICE '  - Daily cron job scheduled for 2:00 AM UTC';
    RAISE NOTICE '  - get_sessions_expiring_soon() helper function created';
    RAISE NOTICE '';
    RAISE NOTICE 'Sessions in trash will be permanently deleted after 30 days';
END $$;
