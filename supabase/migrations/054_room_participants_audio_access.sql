-- Room Participants Audio Access Migration
-- Fixes: Session audio doesn't load for room participants
--
-- Root cause: Storage RLS policy only allows users to view files in their own folder
-- Solution: Add policy that allows room participants to view audio from room sessions

-- ============================================================================
-- ADD STORAGE POLICY FOR ROOM PARTICIPANTS
-- ============================================================================

-- Policy: Room participants can view audio files from sessions in their rooms
-- This allows participants to access audio files from the original session
-- that was copied to the study room (via source_user_id/source_session_id)
DO $$ BEGIN
    CREATE POLICY "Room participants can view audio from room sessions"
        ON storage.objects FOR SELECT
        USING (
            bucket_id = 'audio-files'
            AND EXISTS (
                SELECT 1
                FROM public.room_participants rp
                JOIN public.study_rooms sr ON sr.id = rp.room_id
                JOIN public.sessions s ON s.id = sr.session_id
                WHERE rp.user_id = auth.uid()
                AND rp.is_active = true
                AND sr.is_active = true
                -- Match storage path to original session's audio location
                -- Audio is stored at: {source_user_id}/{source_session_id}/filename
                -- OR for non-copied sessions: {user_id}/{session_id}/filename
                AND (storage.foldername(name))[1] = COALESCE(s.source_user_id, s.user_id)::text
                AND (storage.foldername(name))[2] = COALESCE(s.source_session_id, s.id)::text
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ BEGIN
    RAISE NOTICE '✓ Room participants can now access audio files from room sessions';
    RAISE NOTICE 'Policy: "Room participants can view audio from room sessions" added to storage.objects';
END $$;
