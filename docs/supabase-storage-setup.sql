-- ScribeCat Supabase Storage Configuration
-- Run this in the Supabase SQL Editor AFTER running supabase-schema.sql
--
-- This configures the storage bucket for audio files with proper RLS policies

-- ============================================================================
-- CREATE STORAGE BUCKET
-- ============================================================================

-- Create the audio-files bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'audio-files',
    'audio-files',
    false,  -- Private bucket (requires authentication)
    104857600,  -- 100MB file size limit
    ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE RLS POLICIES
-- ============================================================================

-- Policy: Users can upload audio files to their own folder
DO $$ BEGIN
    CREATE POLICY "Users can upload to their own folder"
        ON storage.objects FOR INSERT
        WITH CHECK (
            bucket_id = 'audio-files'
            AND auth.uid()::text = (storage.foldername(name))[1]
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Policy: Users can view their own audio files
DO $$ BEGIN
    CREATE POLICY "Users can view their own audio files"
        ON storage.objects FOR SELECT
        USING (
            bucket_id = 'audio-files'
            AND auth.uid()::text = (storage.foldername(name))[1]
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Policy: Users can view audio files from sessions shared with them
DO $$ BEGIN
    CREATE POLICY "Users can view audio files from shared sessions"
        ON storage.objects FOR SELECT
        USING (
            bucket_id = 'audio-files'
            AND EXISTS (
                SELECT 1
                FROM public.audio_files af
                JOIN public.sessions s ON s.id = af.session_id
                JOIN public.session_shares ss ON ss.session_id = s.id
                WHERE af.storage_path = name
                AND ss.shared_with_user_id = auth.uid()
                AND ss.accepted_at IS NOT NULL
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Policy: Users can update their own audio files
DO $$ BEGIN
    CREATE POLICY "Users can update their own audio files"
        ON storage.objects FOR UPDATE
        USING (
            bucket_id = 'audio-files'
            AND auth.uid()::text = (storage.foldername(name))[1]
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Policy: Users can delete their own audio files
DO $$ BEGIN
    CREATE POLICY "Users can delete their own audio files"
        ON storage.objects FOR DELETE
        USING (
            bucket_id = 'audio-files'
            AND auth.uid()::text = (storage.foldername(name))[1]
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ BEGIN
    RAISE NOTICE '✓ Supabase Storage configured successfully!';
    RAISE NOTICE 'Bucket created: audio-files (100MB limit, audio/* mime types)';
    RAISE NOTICE 'Storage path format: {user_id}/{session_id}/{filename}';
    RAISE NOTICE 'RLS policies configured for secure file access';
END $$;
