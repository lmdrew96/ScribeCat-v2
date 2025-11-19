-- Fix broken foreign key constraints
-- Migration 022 found that constraints with the right names existed, but they were broken (NULL references)
-- This migration drops the broken constraints and recreates them properly

-- Drop broken constraint: study_rooms.host_id
ALTER TABLE public.study_rooms
DROP CONSTRAINT IF EXISTS study_rooms_host_id_fkey;

-- Drop broken constraint: room_participants.user_id
ALTER TABLE public.room_participants
DROP CONSTRAINT IF EXISTS room_participants_user_id_fkey;

-- Drop broken constraint: room_invitations.inviter_id
ALTER TABLE public.room_invitations
DROP CONSTRAINT IF EXISTS room_invitations_inviter_id_fkey;

-- Drop broken constraint: room_invitations.invitee_id
ALTER TABLE public.room_invitations
DROP CONSTRAINT IF EXISTS room_invitations_invitee_id_fkey;

-- Recreate study_rooms.host_id -> user_profiles
ALTER TABLE public.study_rooms
ADD CONSTRAINT study_rooms_host_id_fkey
FOREIGN KEY (host_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- Recreate room_participants.user_id -> user_profiles
ALTER TABLE public.room_participants
ADD CONSTRAINT room_participants_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- Recreate room_invitations.inviter_id -> user_profiles
ALTER TABLE public.room_invitations
ADD CONSTRAINT room_invitations_inviter_id_fkey
FOREIGN KEY (inviter_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- Recreate room_invitations.invitee_id -> user_profiles
ALTER TABLE public.room_invitations
ADD CONSTRAINT room_invitations_invitee_id_fkey
FOREIGN KEY (invitee_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
