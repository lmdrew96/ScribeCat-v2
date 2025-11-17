-- Study Rooms Migration
-- Implements collaborative study rooms with real-time presence

-- ============================================================================
-- Tables
-- ============================================================================

-- Study Rooms
CREATE TABLE IF NOT EXISTS public.study_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    host_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    max_participants INTEGER NOT NULL DEFAULT 8 CHECK (max_participants >= 2 AND max_participants <= 8),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- Room Participants
CREATE TABLE IF NOT EXISTS public.room_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT unique_active_participant UNIQUE (room_id, user_id, is_active)
);

-- Room Invitations
CREATE TABLE IF NOT EXISTS public.room_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT no_self_invite CHECK (inviter_id != invitee_id),
    CONSTRAINT unique_room_invitation UNIQUE (room_id, invitee_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_study_rooms_host ON public.study_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_study_rooms_active ON public.study_rooms(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_study_rooms_session ON public.study_rooms(session_id);

CREATE INDEX IF NOT EXISTS idx_room_participants_room ON public.room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user ON public.room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_active ON public.room_participants(room_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_room_invitations_invitee ON public.room_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_room_invitations_room ON public.room_invitations(room_id);
CREATE INDEX IF NOT EXISTS idx_room_invitations_status ON public.room_invitations(status) WHERE status = 'pending';

-- ============================================================================
-- Triggers
-- ============================================================================

-- Update updated_at timestamp on study_rooms
CREATE OR REPLACE FUNCTION public.update_study_rooms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_study_rooms_updated_at
    BEFORE UPDATE ON public.study_rooms
    FOR EACH ROW
    EXECUTE FUNCTION public.update_study_rooms_updated_at();

-- Update updated_at timestamp on room_invitations
CREATE OR REPLACE FUNCTION public.update_room_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_room_invitations_updated_at
    BEFORE UPDATE ON public.room_invitations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_room_invitations_updated_at();

-- Automatically add host as first participant when room is created
CREATE OR REPLACE FUNCTION public.add_host_as_participant()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.room_participants (room_id, user_id, is_active)
    VALUES (NEW.id, NEW.host_id, true);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_add_host_as_participant
    AFTER INSERT ON public.study_rooms
    FOR EACH ROW
    EXECUTE FUNCTION public.add_host_as_participant();

-- Mark room_participants as inactive when user leaves
CREATE OR REPLACE FUNCTION public.deactivate_participant_on_leave()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.left_at IS NOT NULL AND OLD.left_at IS NULL THEN
        NEW.is_active = false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_deactivate_participant_on_leave
    BEFORE UPDATE ON public.room_participants
    FOR EACH ROW
    EXECUTE FUNCTION public.deactivate_participant_on_leave();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Check if user is in an active room
CREATE OR REPLACE FUNCTION public.is_user_in_room(
    p_user_id UUID,
    p_room_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.room_participants
        WHERE user_id = p_user_id
        AND room_id = p_room_id
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get active participant count for a room
CREATE OR REPLACE FUNCTION public.get_room_participant_count(
    p_room_id UUID
)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM public.room_participants
        WHERE room_id = p_room_id
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if room is full
CREATE OR REPLACE FUNCTION public.is_room_full(
    p_room_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_max_participants INTEGER;
    v_current_count INTEGER;
BEGIN
    SELECT max_participants INTO v_max_participants
    FROM public.study_rooms
    WHERE id = p_room_id;

    v_current_count := public.get_room_participant_count(p_room_id);

    RETURN v_current_count >= v_max_participants;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if users are friends (for invitation validation)
-- This references the existing are_friends function from 010_friends_system.sql

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_invitations ENABLE ROW LEVEL SECURITY;

-- study_rooms policies

-- Users can view rooms they're participating in or invited to
CREATE POLICY "Users can view their rooms"
    ON public.study_rooms
    FOR SELECT
    USING (
        -- User is the host
        auth.uid() = host_id
        OR
        -- User is an active participant
        EXISTS (
            SELECT 1 FROM public.room_participants
            WHERE room_id = id
            AND user_id = auth.uid()
            AND is_active = true
        )
        OR
        -- User has a pending invitation
        EXISTS (
            SELECT 1 FROM public.room_invitations
            WHERE room_id = id
            AND invitee_id = auth.uid()
            AND status = 'pending'
        )
    );

-- Users can create rooms
CREATE POLICY "Users can create rooms"
    ON public.study_rooms
    FOR INSERT
    WITH CHECK (
        auth.uid() = host_id
    );

-- Only host can update room
CREATE POLICY "Host can update room"
    ON public.study_rooms
    FOR UPDATE
    USING (auth.uid() = host_id)
    WITH CHECK (auth.uid() = host_id);

-- room_participants policies

-- Users can view participants in their rooms
CREATE POLICY "Users can view room participants"
    ON public.room_participants
    FOR SELECT
    USING (
        -- User is in the room
        EXISTS (
            SELECT 1 FROM public.room_participants AS rp
            WHERE rp.room_id = room_id
            AND rp.user_id = auth.uid()
            AND rp.is_active = true
        )
    );

-- Users can join rooms (via invitation acceptance)
CREATE POLICY "Users can join rooms"
    ON public.room_participants
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND
        -- User has accepted invitation
        EXISTS (
            SELECT 1 FROM public.room_invitations
            WHERE room_id = room_participants.room_id
            AND invitee_id = auth.uid()
            AND status = 'accepted'
        )
    );

-- Users can leave rooms (update their own participant record)
CREATE POLICY "Users can leave rooms"
    ON public.room_participants
    FOR UPDATE
    USING (
        auth.uid() = user_id
        OR
        -- Host can remove participants
        EXISTS (
            SELECT 1 FROM public.study_rooms
            WHERE id = room_id
            AND host_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM public.study_rooms
            WHERE id = room_id
            AND host_id = auth.uid()
        )
    );

-- room_invitations policies

-- Users can view invitations they sent or received
CREATE POLICY "Users can view their invitations"
    ON public.room_invitations
    FOR SELECT
    USING (
        auth.uid() = inviter_id
        OR auth.uid() = invitee_id
    );

-- Host can invite friends to their rooms
CREATE POLICY "Host can invite friends"
    ON public.room_invitations
    FOR INSERT
    WITH CHECK (
        auth.uid() = inviter_id
        AND
        -- Inviter is the host of the room
        EXISTS (
            SELECT 1 FROM public.study_rooms
            WHERE id = room_id
            AND host_id = auth.uid()
        )
        AND
        -- Invitee is a friend
        public.are_friends(inviter_id, invitee_id)
        AND
        -- Room is not full
        NOT public.is_room_full(room_id)
    );

-- Users can update invitations they received (accept/decline)
CREATE POLICY "Users can respond to invitations"
    ON public.room_invitations
    FOR UPDATE
    USING (auth.uid() = invitee_id)
    WITH CHECK (auth.uid() = invitee_id);

-- Host can cancel invitations
CREATE POLICY "Host can cancel invitations"
    ON public.room_invitations
    FOR DELETE
    USING (
        auth.uid() = inviter_id
        AND
        EXISTS (
            SELECT 1 FROM public.study_rooms
            WHERE id = room_id
            AND host_id = auth.uid()
        )
    );

-- ============================================================================
-- Realtime Publication
-- ============================================================================

-- Enable realtime for room_participants table (for live participant updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.study_rooms IS 'Collaborative study rooms where friends can study together';
COMMENT ON TABLE public.room_participants IS 'Tracks which users are in which rooms';
COMMENT ON TABLE public.room_invitations IS 'Invitations to join study rooms (friends only)';

COMMENT ON COLUMN public.study_rooms.session_id IS 'The shared session copy that all participants can edit';
COMMENT ON COLUMN public.study_rooms.is_active IS 'Whether the room is currently active (host can close)';
COMMENT ON COLUMN public.room_participants.is_active IS 'Whether the participant is currently in the room';
