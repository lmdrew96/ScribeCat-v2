-- ScribeCat Supabase Database Schema
-- Run this entire file in the Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- STEP 1: CREATE ALL TABLES (No RLS yet)
-- ============================================================================

-- User Profiles Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    google_id TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    preferences JSONB DEFAULT '{}'::jsonb,
    storage_used_bytes BIGINT DEFAULT 0
);

-- Sessions Table (core data)
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER DEFAULT 0,
    transcription_text TEXT,
    transcription_provider TEXT,
    transcription_language TEXT DEFAULT 'en',
    transcription_confidence REAL,
    transcription_timestamp TIMESTAMP WITH TIME ZONE,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    course_id TEXT,
    course_title TEXT,
    course_number TEXT,
    is_template BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1,
    CONSTRAINT sessions_duration_positive CHECK (duration >= 0)
);

-- Audio Files Table
CREATE TABLE IF NOT EXISTS public.audio_files (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    file_size_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'audio/webm',
    duration_seconds INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT audio_files_file_size_positive CHECK (file_size_bytes > 0)
);

-- Permission Level Enum
DO $$ BEGIN
    CREATE TYPE permission_level AS ENUM ('viewer', 'editor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Session Shares Table
CREATE TABLE IF NOT EXISTS public.session_shares (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    shared_by_user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    shared_with_user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    permission_level permission_level NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(session_id, shared_with_user_id)
);

-- Share Invitations Table
CREATE TABLE IF NOT EXISTS public.share_invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    invited_by_user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    permission_level permission_level NOT NULL DEFAULT 'viewer',
    invitation_token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(session_id, email)
);

-- Session Versions Table
CREATE TABLE IF NOT EXISTS public.session_versions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    version INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by_user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    change_description TEXT,
    UNIQUE(session_id, version)
);

-- Collaboration Sessions Table
CREATE TABLE IF NOT EXISTS public.collaboration_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cursor_position INTEGER,
    is_recording BOOLEAN DEFAULT FALSE,
    UNIQUE(session_id, user_id)
);

-- ============================================================================
-- STEP 2: CREATE INDEXES
-- ============================================================================

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON public.sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_deleted_at ON public.sessions(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_tags ON public.sessions USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_sessions_user_created ON public.sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_updated ON public.sessions(user_id, updated_at DESC);

-- Indexes for audio_files
CREATE INDEX IF NOT EXISTS idx_audio_files_session_id ON public.audio_files(session_id);

-- Indexes for session_shares
CREATE INDEX IF NOT EXISTS idx_session_shares_session_id ON public.session_shares(session_id);
CREATE INDEX IF NOT EXISTS idx_session_shares_shared_with ON public.session_shares(shared_with_user_id);

-- Indexes for share_invitations
CREATE INDEX IF NOT EXISTS idx_share_invitations_email ON public.share_invitations(email);
CREATE INDEX IF NOT EXISTS idx_share_invitations_token ON public.share_invitations(invitation_token);

-- Indexes for session_versions
CREATE INDEX IF NOT EXISTS idx_session_versions_session_id ON public.session_versions(session_id);
CREATE INDEX IF NOT EXISTS idx_session_versions_created_at ON public.session_versions(created_at DESC);

-- Indexes for collaboration_sessions
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_session_id ON public.collaboration_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_last_seen ON public.collaboration_sessions(last_seen_at);

-- ============================================================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: CREATE RLS POLICIES
-- ============================================================================

-- Policies for user_profiles
DO $$ BEGIN
    CREATE POLICY "Users can view their own profile"
        ON public.user_profiles FOR SELECT
        USING (auth.uid() = id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update their own profile"
        ON public.user_profiles FOR UPDATE
        USING (auth.uid() = id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert their own profile"
        ON public.user_profiles FOR INSERT
        WITH CHECK (auth.uid() = id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Policies for sessions
DO $$ BEGIN
    CREATE POLICY "Users can view their own sessions"
        ON public.sessions FOR SELECT
        USING (auth.uid() = user_id AND deleted_at IS NULL);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can view sessions shared with them"
        ON public.sessions FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM public.session_shares
                WHERE session_shares.session_id = sessions.id
                AND session_shares.shared_with_user_id = auth.uid()
                AND session_shares.accepted_at IS NOT NULL
            )
            AND deleted_at IS NULL
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert their own sessions"
        ON public.sessions FOR INSERT
        WITH CHECK (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update their own sessions"
        ON public.sessions FOR UPDATE
        USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update sessions they have editor permission on"
        ON public.sessions FOR UPDATE
        USING (
            EXISTS (
                SELECT 1 FROM public.session_shares
                WHERE session_shares.session_id = sessions.id
                AND session_shares.shared_with_user_id = auth.uid()
                AND session_shares.permission_level = 'editor'
                AND session_shares.accepted_at IS NOT NULL
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete their own sessions"
        ON public.sessions FOR DELETE
        USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Policies for audio_files
DO $$ BEGIN
    CREATE POLICY "Users can view audio files for their sessions"
        ON public.audio_files FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM public.sessions
                WHERE sessions.id = audio_files.session_id
                AND sessions.user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can view audio files for shared sessions"
        ON public.audio_files FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM public.session_shares
                JOIN public.sessions ON sessions.id = session_shares.session_id
                WHERE sessions.id = audio_files.session_id
                AND session_shares.shared_with_user_id = auth.uid()
                AND session_shares.accepted_at IS NOT NULL
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert audio files for their sessions"
        ON public.audio_files FOR INSERT
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.sessions
                WHERE sessions.id = audio_files.session_id
                AND sessions.user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete their own audio files"
        ON public.audio_files FOR DELETE
        USING (
            EXISTS (
                SELECT 1 FROM public.sessions
                WHERE sessions.id = audio_files.session_id
                AND sessions.user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Policies for session_shares
DO $$ BEGIN
    CREATE POLICY "Users can view shares for their sessions"
        ON public.session_shares FOR SELECT
        USING (
            auth.uid() = shared_by_user_id OR auth.uid() = shared_with_user_id
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Session owners can create shares"
        ON public.session_shares FOR INSERT
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.sessions
                WHERE sessions.id = session_shares.session_id
                AND sessions.user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Session owners can update shares"
        ON public.session_shares FOR UPDATE
        USING (
            EXISTS (
                SELECT 1 FROM public.sessions
                WHERE sessions.id = session_shares.session_id
                AND sessions.user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Session owners can delete shares"
        ON public.session_shares FOR DELETE
        USING (
            EXISTS (
                SELECT 1 FROM public.sessions
                WHERE sessions.id = session_shares.session_id
                AND sessions.user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Shared users can accept invitations"
        ON public.session_shares FOR UPDATE
        USING (auth.uid() = shared_with_user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Policies for share_invitations
DO $$ BEGIN
    CREATE POLICY "Users can view invitations they created"
        ON public.share_invitations FOR SELECT
        USING (auth.uid() = invited_by_user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can view invitations sent to their email"
        ON public.share_invitations FOR SELECT
        USING (
            email = (SELECT email FROM public.user_profiles WHERE id = auth.uid())
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Session owners can create invitations"
        ON public.share_invitations FOR INSERT
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.sessions
                WHERE sessions.id = share_invitations.session_id
                AND sessions.user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Session owners can delete invitations"
        ON public.share_invitations FOR DELETE
        USING (auth.uid() = invited_by_user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Policies for session_versions
DO $$ BEGIN
    CREATE POLICY "Users can view versions of their sessions"
        ON public.session_versions FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM public.sessions
                WHERE sessions.id = session_versions.session_id
                AND sessions.user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can view versions of shared sessions"
        ON public.session_versions FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM public.session_shares
                WHERE session_shares.session_id = session_versions.session_id
                AND session_shares.shared_with_user_id = auth.uid()
                AND session_shares.accepted_at IS NOT NULL
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can create versions for their sessions"
        ON public.session_versions FOR INSERT
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.sessions
                WHERE sessions.id = session_versions.session_id
                AND (sessions.user_id = auth.uid() OR EXISTS (
                    SELECT 1 FROM public.session_shares
                    WHERE session_shares.session_id = sessions.id
                    AND session_shares.shared_with_user_id = auth.uid()
                    AND session_shares.permission_level = 'editor'
                ))
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Policies for collaboration_sessions
DO $$ BEGIN
    CREATE POLICY "Users can view presence in sessions they have access to"
        ON public.collaboration_sessions FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM public.sessions
                WHERE sessions.id = collaboration_sessions.session_id
                AND (
                    sessions.user_id = auth.uid()
                    OR EXISTS (
                        SELECT 1 FROM public.session_shares
                        WHERE session_shares.session_id = sessions.id
                        AND session_shares.shared_with_user_id = auth.uid()
                        AND session_shares.accepted_at IS NOT NULL
                    )
                )
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert their own presence"
        ON public.collaboration_sessions FOR INSERT
        WITH CHECK (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update their own presence"
        ON public.collaboration_sessions FOR UPDATE
        USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete their own presence"
        ON public.collaboration_sessions FOR DELETE
        USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 5: CREATE FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for sessions table
DROP TRIGGER IF EXISTS update_sessions_updated_at ON public.sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON public.sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_profiles table
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to accept share invitation
CREATE OR REPLACE FUNCTION public.accept_share_invitation(invitation_token_param TEXT)
RETURNS UUID AS $$
DECLARE
    invitation_record RECORD;
    new_share_id UUID;
BEGIN
    -- Get invitation
    SELECT * INTO invitation_record
    FROM public.share_invitations
    WHERE invitation_token = invitation_token_param
    AND expires_at > NOW()
    AND accepted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invitation';
    END IF;

    -- Verify user email matches invitation
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND email = invitation_record.email
    ) THEN
        RAISE EXCEPTION 'This invitation is for a different email address';
    END IF;

    -- Create session share
    INSERT INTO public.session_shares (
        session_id,
        shared_by_user_id,
        shared_with_user_id,
        permission_level,
        accepted_at
    ) VALUES (
        invitation_record.session_id,
        invitation_record.invited_by_user_id,
        auth.uid(),
        invitation_record.permission_level,
        NOW()
    ) RETURNING id INTO new_share_id;

    -- Mark invitation as accepted
    UPDATE public.share_invitations
    SET accepted_at = NOW()
    WHERE id = invitation_record.id;

    RETURN new_share_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old collaboration sessions (inactive users)
CREATE OR REPLACE FUNCTION public.cleanup_stale_collaboration_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM public.collaboration_sessions
    WHERE last_seen_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ BEGIN
    RAISE NOTICE '✓ ScribeCat database schema created successfully!';
    RAISE NOTICE 'Tables created: user_profiles, sessions, audio_files, session_shares, share_invitations, session_versions, collaboration_sessions';
    RAISE NOTICE 'RLS enabled and policies configured';
    RAISE NOTICE 'Functions and triggers configured';
END $$;
