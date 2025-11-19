-- Add missing foreign key constraints to user_profiles
-- These constraints were defined in migrations 010 and 011 but failed to create
-- because user_profiles table didn't exist yet

-- Study Rooms: host_id -> user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'study_rooms_host_id_fkey'
    AND table_name = 'study_rooms'
  ) THEN
    ALTER TABLE public.study_rooms
    ADD CONSTRAINT study_rooms_host_id_fkey
    FOREIGN KEY (host_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Room Participants: user_id -> user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'room_participants_user_id_fkey'
    AND table_name = 'room_participants'
  ) THEN
    ALTER TABLE public.room_participants
    ADD CONSTRAINT room_participants_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Room Invitations: inviter_id -> user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'room_invitations_inviter_id_fkey'
    AND table_name = 'room_invitations'
  ) THEN
    ALTER TABLE public.room_invitations
    ADD CONSTRAINT room_invitations_inviter_id_fkey
    FOREIGN KEY (inviter_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Room Invitations: invitee_id -> user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'room_invitations_invitee_id_fkey'
    AND table_name = 'room_invitations'
  ) THEN
    ALTER TABLE public.room_invitations
    ADD CONSTRAINT room_invitations_invitee_id_fkey
    FOREIGN KEY (invitee_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Friendships: user_id -> user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'friendships_user_id_fkey'
    AND table_name = 'friendships'
  ) THEN
    ALTER TABLE public.friendships
    ADD CONSTRAINT friendships_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Friendships: friend_id -> user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'friendships_friend_id_fkey'
    AND table_name = 'friendships'
  ) THEN
    ALTER TABLE public.friendships
    ADD CONSTRAINT friendships_friend_id_fkey
    FOREIGN KEY (friend_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Friend Requests: sender_id -> user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'friend_requests_sender_id_fkey'
    AND table_name = 'friend_requests'
  ) THEN
    ALTER TABLE public.friend_requests
    ADD CONSTRAINT friend_requests_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Friend Requests: recipient_id -> user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'friend_requests_recipient_id_fkey'
    AND table_name = 'friend_requests'
  ) THEN
    ALTER TABLE public.friend_requests
    ADD CONSTRAINT friend_requests_recipient_id_fkey
    FOREIGN KEY (recipient_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
