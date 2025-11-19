/**
 * SupabaseStudyRoomsRepository
 *
 * Infrastructure layer service for study room operations.
 * Handles rooms, participants, and invitations using Supabase.
 */

import { SupabaseClient as SupabaseClientType } from '@supabase/supabase-js';
import { SupabaseClient } from './SupabaseClient.js';
import { StudyRoom } from '../../../domain/entities/StudyRoom.js';
import { RoomParticipant } from '../../../domain/entities/RoomParticipant.js';
import { RoomInvitation, RoomInvitationStatus } from '../../../domain/entities/RoomInvitation.js';

/**
 * Repository for managing study rooms
 */
export class SupabaseStudyRoomsRepository {
  /**
   * Get a fresh Supabase client with the current session
   */
  private getClient(): SupabaseClientType {
    return SupabaseClient.getInstance().getClient();
  }

  // ============================================================================
  // Room Operations
  // ============================================================================

  /**
   * Create a new study room
   * If sessionId is provided, creates a copy for collaborative editing
   */
  async createRoom(params: {
    name: string;
    hostId: string;
    sessionId: string; // Will be copied
    maxParticipants: number;
  }): Promise<StudyRoom> {
    try {
      // Session copying will be handled by the application layer
      // The session should already be copied and shared before creating the room

      const { data, error } = await this.getClient()
        .from('study_rooms')
        .insert({
          name: params.name,
          host_id: params.hostId,
          session_id: params.sessionId,
          max_participants: params.maxParticipants,
          is_active: true,
        })
        .select(`
          id,
          name,
          host_id,
          session_id,
          max_participants,
          is_active,
          created_at,
          updated_at,
          closed_at,
          host_profile:user_profiles!study_rooms_host_id_fkey (
            email,
            full_name,
            avatar_url
          )
        `)
        .single();

      if (error) {
        console.error('Error creating room:', error);
        throw new Error(`Failed to create room: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned after creating room');
      }

      const hostProfile = Array.isArray(data.host_profile) ? data.host_profile[0] : data.host_profile;

      // Automatically add the host as a participant
      const { error: participantError } = await this.getClient()
        .from('room_participants')
        .insert({
          room_id: data.id,
          user_id: params.hostId,
          joined_at: new Date().toISOString(),
          is_active: true,
        });

      if (participantError) {
        console.error('Error adding host as participant:', participantError);
        // Don't throw - room was created successfully, just log the error
      }

      return StudyRoom.fromDatabase({
        id: data.id,
        name: data.name,
        host_id: data.host_id,
        session_id: data.session_id,
        max_participants: data.max_participants,
        is_active: data.is_active,
        created_at: data.created_at,
        updated_at: data.updated_at,
        closed_at: data.closed_at,
        host_email: hostProfile?.email,
        host_full_name: hostProfile?.full_name,
        host_avatar_url: hostProfile?.avatar_url,
      });
    } catch (error) {
      console.error('Exception in createRoom:', error);
      throw error;
    }
  }

  /**
   * Get active rooms from friends (or rooms user is in)
   */
  async getUserRooms(userId: string): Promise<StudyRoom[]> {
    try {
      // With simplified RLS, get rooms via two queries:
      // 1. Rooms where user is host
      // 2. Rooms where user is participant

      const roomIds: Set<string> = new Set();
      const roomsMap: Map<string, any> = new Map();

      // Query 1: Get rooms where user is host
      const { data: hostedRooms, error: hostedError } = await this.getClient()
        .from('study_rooms')
        .select(`
          id,
          name,
          host_id,
          session_id,
          max_participants,
          is_active,
          created_at,
          updated_at,
          closed_at,
          host_profile:user_profiles!study_rooms_host_id_fkey (
            email,
            full_name,
            avatar_url
          )
        `)
        .eq('host_id', userId)
        .eq('is_active', true);

      if (hostedError) {
        console.error('Error fetching hosted rooms:', hostedError);
        throw new Error(`Failed to fetch hosted rooms: ${hostedError.message}`);
      }

      if (hostedRooms) {
        for (const room of hostedRooms) {
          roomIds.add(room.id);
          roomsMap.set(room.id, room);
        }
      }

      // Query 2: Get rooms where user is a participant
      const { data: participantRooms, error: participantError } = await this.getClient()
        .from('room_participants')
        .select('room_id')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (participantError) {
        console.error('Error fetching participant rooms:', participantError);
        // Don't throw, just log - we at least have hosted rooms
      } else if (participantRooms) {
        for (const p of participantRooms) {
          if (!roomIds.has(p.room_id)) {
            // Need to fetch this room's details using SECURITY DEFINER function
            // For now, skip rooms user is not hosting (RLS limitation)
            // TODO: Implement SECURITY DEFINER function to get room details
          }
        }
      }

      // Get participant counts for all rooms
      const rooms: StudyRoom[] = [];
      for (const [roomId, roomData] of roomsMap) {
        const { count } = await this.getClient()
          .from('room_participants')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', roomId)
          .eq('is_active', true);

        const hostProfile = Array.isArray(roomData.host_profile) ? roomData.host_profile[0] : roomData.host_profile;

        rooms.push(StudyRoom.fromDatabase({
          id: roomData.id,
          name: roomData.name,
          host_id: roomData.host_id,
          session_id: roomData.session_id,
          max_participants: roomData.max_participants,
          is_active: roomData.is_active,
          created_at: roomData.created_at,
          updated_at: roomData.updated_at,
          closed_at: roomData.closed_at,
          host_email: hostProfile?.email,
          host_full_name: hostProfile?.full_name,
          host_avatar_url: hostProfile?.avatar_url,
          participant_count: count || 0,
        }));
      }

      // Sort by created_at descending
      rooms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return rooms;
    } catch (error) {
      console.error('Exception in getUserRooms:', error);
      throw error;
    }
  }

  /**
   * Get a specific room by ID
   */
  async getRoomById(roomId: string): Promise<StudyRoom | null> {
    try {
      const { data, error } = await this.getClient()
        .from('study_rooms')
        .select(`
          id,
          name,
          host_id,
          session_id,
          max_participants,
          is_active,
          created_at,
          updated_at,
          closed_at,
          host_profile:user_profiles!study_rooms_host_id_fkey (
            email,
            full_name,
            avatar_url
          ),
          sessions!study_rooms_session_id_fkey (
            title
          )
        `)
        .eq('id', roomId)
        .single();

      if (error) {
        console.error('Error fetching room:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      const hostProfile = Array.isArray(data.host_profile) ? data.host_profile[0] : data.host_profile;
      const session = Array.isArray(data.sessions) ? data.sessions[0] : data.sessions;

      // Get participant count
      const participantCount = await this.getActiveParticipantCount(roomId);

      return StudyRoom.fromDatabase({
        id: data.id,
        name: data.name,
        host_id: data.host_id,
        session_id: data.session_id,
        max_participants: data.max_participants,
        is_active: data.is_active,
        created_at: data.created_at,
        updated_at: data.updated_at,
        closed_at: data.closed_at,
        host_email: hostProfile?.email,
        host_full_name: hostProfile?.full_name,
        host_avatar_url: hostProfile?.avatar_url,
        session_title: session?.title,
        participant_count: participantCount,
      });
    } catch (error) {
      console.error('Exception in getRoomById:', error);
      return null;
    }
  }

  /**
   * Close a room (host only)
   */
  async closeRoom(roomId: string, hostId: string): Promise<void> {
    try {
      const { error } = await this.getClient()
        .from('study_rooms')
        .update({
          is_active: false,
          closed_at: new Date().toISOString(),
        })
        .eq('id', roomId)
        .eq('host_id', hostId);

      if (error) {
        console.error('Error closing room:', error);
        throw new Error(`Failed to close room: ${error.message}`);
      }
    } catch (error) {
      console.error('Exception in closeRoom:', error);
      throw error;
    }
  }

  /**
   * Update room settings (host only)
   */
  async updateRoom(roomId: string, hostId: string, updates: { name?: string; maxParticipants?: number }): Promise<void> {
    try {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.maxParticipants !== undefined) updateData.max_participants = updates.maxParticipants;

      const { error } = await this.getClient()
        .from('study_rooms')
        .update(updateData)
        .eq('id', roomId)
        .eq('host_id', hostId);

      if (error) {
        console.error('Error updating room:', error);
        throw new Error(`Failed to update room: ${error.message}`);
      }
    } catch (error) {
      console.error('Exception in updateRoom:', error);
      throw error;
    }
  }

  // ============================================================================
  // Participant Operations
  // ============================================================================

  /**
   * Get active participants in a room
   */
  async getRoomParticipants(roomId: string): Promise<RoomParticipant[]> {
    try {
      const { data, error } = await this.getClient()
        .from('room_participants')
        .select(`
          id,
          room_id,
          user_id,
          joined_at,
          left_at,
          is_active,
          user_profile:user_profiles!room_participants_user_id_fkey (
            email,
            full_name,
            avatar_url
          )
        `)
        .eq('room_id', roomId)
        .eq('is_active', true)
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('Error fetching participants:', error);
        throw new Error(`Failed to fetch participants: ${error.message}`);
      }

      if (!data) {
        return [];
      }

      return data.map((row: any) => {
        const userProfile = Array.isArray(row.user_profile) ? row.user_profile[0] : row.user_profile;

        return RoomParticipant.fromDatabase({
          id: row.id,
          room_id: row.room_id,
          user_id: row.user_id,
          joined_at: row.joined_at,
          left_at: row.left_at,
          is_active: row.is_active,
          user_email: userProfile?.email,
          user_full_name: userProfile?.full_name,
          user_avatar_url: userProfile?.avatar_url,
        });
      });
    } catch (error) {
      console.error('Exception in getRoomParticipants:', error);
      throw error;
    }
  }

  /**
   * Get active participant count
   */
  async getActiveParticipantCount(roomId: string): Promise<number> {
    try {
      const { count, error } = await this.getClient()
        .from('room_participants')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .eq('is_active', true);

      if (error) {
        console.error('Error counting participants:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Exception in getActiveParticipantCount:', error);
      return 0;
    }
  }

  /**
   * Join a room (after accepting invitation)
   * Uses UPSERT pattern to prevent duplicate active participant records
   */
  async joinRoom(roomId: string, userId: string): Promise<RoomParticipant> {
    try {
      // First, check if an active participant record already exists
      const { data: existingRecord, error: checkError } = await this.getClient()
        .from('room_participants')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing participant:', checkError);
        throw new Error(`Failed to check existing participant: ${checkError.message}`);
      }

      let data;
      let error;

      if (existingRecord) {
        // Update existing active record (user rejoining)
        const updateResult = await this.getClient()
          .from('room_participants')
          .update({
            joined_at: new Date().toISOString(),
            left_at: null,
            is_active: true,
          })
          .eq('id', existingRecord.id)
          .select(`
            id,
            room_id,
            user_id,
            joined_at,
            left_at,
            is_active,
            user_profile:user_profiles!room_participants_user_id_fkey (
              email,
              full_name,
              avatar_url
            )
          `)
          .single();

        data = updateResult.data;
        error = updateResult.error;
      } else {
        // Insert new participant record
        const insertResult = await this.getClient()
          .from('room_participants')
          .insert({
            room_id: roomId,
            user_id: userId,
            is_active: true,
          })
          .select(`
            id,
            room_id,
            user_id,
            joined_at,
            left_at,
            is_active,
            user_profile:user_profiles!room_participants_user_id_fkey (
              email,
              full_name,
              avatar_url
            )
          `)
          .single();

        data = insertResult.data;
        error = insertResult.error;
      }

      if (error) {
        console.error('Error joining room:', error);
        throw new Error(`Failed to join room: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned after joining room');
      }

      const userProfile = Array.isArray(data.user_profile) ? data.user_profile[0] : data.user_profile;

      return RoomParticipant.fromDatabase({
        id: data.id,
        room_id: data.room_id,
        user_id: data.user_id,
        joined_at: data.joined_at,
        left_at: data.left_at,
        is_active: data.is_active,
        user_email: userProfile?.email,
        user_full_name: userProfile?.full_name,
        user_avatar_url: userProfile?.avatar_url,
      });
    } catch (error) {
      console.error('Exception in joinRoom:', error);
      throw error;
    }
  }

  /**
   * Leave a room
   */
  async leaveRoom(roomId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.getClient()
        .from('room_participants')
        .update({
          left_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        console.error('Error leaving room:', error);
        throw new Error(`Failed to leave room: ${error.message}`);
      }
    } catch (error) {
      console.error('Exception in leaveRoom:', error);
      throw error;
    }
  }

  /**
   * Remove a participant from room (host only)
   */
  async removeParticipant(roomId: string, participantId: string, hostId: string): Promise<void> {
    try {
      // Verify the requester is the host
      const room = await this.getRoomById(roomId);
      if (!room || room.hostId !== hostId) {
        throw new Error('Only the host can remove participants');
      }

      const { error } = await this.getClient()
        .from('room_participants')
        .update({
          left_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('room_id', roomId)
        .eq('user_id', participantId)
        .eq('is_active', true);

      if (error) {
        console.error('Error removing participant:', error);
        throw new Error(`Failed to remove participant: ${error.message}`);
      }
    } catch (error) {
      console.error('Exception in removeParticipant:', error);
      throw error;
    }
  }

  /**
   * Check if user is in a room
   */
  async isUserInRoom(roomId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.getClient().rpc('is_user_in_room', {
        p_user_id: userId,
        p_room_id: roomId,
      });

      if (error) {
        console.error('Error checking if user is in room:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Exception in isUserInRoom:', error);
      return false;
    }
  }

  // ============================================================================
  // Invitation Operations
  // ============================================================================

  /**
   * Send invitation to friend
   */
  async sendInvitation(params: {
    roomId: string;
    inviterId: string;
    inviteeId: string;
  }): Promise<RoomInvitation> {
    try {
      // First, fetch the room name to include in invitation
      const { data: roomData } = await this.getClient()
        .from('study_rooms')
        .select('name')
        .eq('id', params.roomId)
        .single();

      const { data, error } = await this.getClient()
        .from('room_invitations')
        .insert({
          room_id: params.roomId,
          inviter_id: params.inviterId,
          invitee_id: params.inviteeId,
          status: 'pending',
          room_name: roomData?.name || null,
        })
        .select(`
          id,
          room_id,
          inviter_id,
          invitee_id,
          status,
          created_at,
          updated_at,
          room_name,
          inviter_profile:user_profiles!room_invitations_inviter_id_fkey (
            email,
            full_name,
            avatar_url
          ),
          invitee_profile:user_profiles!room_invitations_invitee_id_fkey (
            email,
            full_name,
            avatar_url
          )
        `)
        .single();

      if (error) {
        console.error('Error sending invitation:', error);
        throw new Error(`Failed to send invitation: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned after sending invitation');
      }

      const inviterProfile = Array.isArray(data.inviter_profile) ? data.inviter_profile[0] : data.inviter_profile;
      const inviteeProfile = Array.isArray(data.invitee_profile) ? data.invitee_profile[0] : data.invitee_profile;

      return RoomInvitation.fromDatabase({
        id: data.id,
        room_id: data.room_id,
        inviter_id: data.inviter_id,
        invitee_id: data.invitee_id,
        status: data.status,
        created_at: data.created_at,
        updated_at: data.updated_at,
        room_name: data.room_name,
        inviter_email: inviterProfile?.email,
        inviter_full_name: inviterProfile?.full_name,
        inviter_avatar_url: inviterProfile?.avatar_url,
        invitee_email: inviteeProfile?.email,
        invitee_full_name: inviteeProfile?.full_name,
        invitee_avatar_url: inviteeProfile?.avatar_url,
      });
    } catch (error) {
      console.error('Exception in sendInvitation:', error);
      throw error;
    }
  }

  /**
   * Get invitations for a user (both sent and received)
   */
  async getUserInvitations(userId: string): Promise<RoomInvitation[]> {
    try {
      // Query invitations WITH room_name column (now stored denormalized)
      const { data, error } = await this.getClient()
        .from('room_invitations')
        .select(`
          id,
          room_id,
          inviter_id,
          invitee_id,
          status,
          created_at,
          updated_at,
          room_name,
          inviter_profile:user_profiles!room_invitations_inviter_id_fkey (
            email,
            full_name,
            avatar_url
          ),
          invitee_profile:user_profiles!room_invitations_invitee_id_fkey (
            email,
            full_name,
            avatar_url
          )
        `)
        .or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching invitations:', error);
        throw new Error(`Failed to fetch invitations: ${error.message}`);
      }

      if (!data) {
        return [];
      }

      // Map database rows to domain entities
      const invitations: RoomInvitation[] = data.map((row) => {
        const inviterProfile = Array.isArray(row.inviter_profile) ? row.inviter_profile[0] : row.inviter_profile;
        const inviteeProfile = Array.isArray(row.invitee_profile) ? row.invitee_profile[0] : row.invitee_profile;

        return RoomInvitation.fromDatabase({
          id: row.id,
          room_id: row.room_id,
          inviter_id: row.inviter_id,
          invitee_id: row.invitee_id,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at,
          room_name: row.room_name,
          inviter_email: inviterProfile?.email,
          inviter_full_name: inviterProfile?.full_name,
          inviter_avatar_url: inviterProfile?.avatar_url,
          invitee_email: inviteeProfile?.email,
          invitee_full_name: inviteeProfile?.full_name,
          invitee_avatar_url: inviteeProfile?.avatar_url,
        });
      });

      return invitations;
    } catch (error) {
      console.error('Exception in getUserInvitations:', error);
      throw error;
    }
  }

  /**
   * Get pending incoming invitations
   */
  async getPendingInvitations(userId: string): Promise<RoomInvitation[]> {
    const allInvitations = await this.getUserInvitations(userId);
    return allInvitations.filter(inv => inv.isInvitee(userId) && inv.isPending());
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(invitationId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.getClient()
        .from('room_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId)
        .eq('invitee_id', userId);

      if (error) {
        console.error('Error accepting invitation:', error);
        throw new Error(`Failed to accept invitation: ${error.message}`);
      }
    } catch (error) {
      console.error('Exception in acceptInvitation:', error);
      throw error;
    }
  }

  /**
   * Decline invitation
   */
  async declineInvitation(invitationId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.getClient()
        .from('room_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId)
        .eq('invitee_id', userId);

      if (error) {
        console.error('Error declining invitation:', error);
        throw new Error(`Failed to decline invitation: ${error.message}`);
      }
    } catch (error) {
      console.error('Exception in declineInvitation:', error);
      throw error;
    }
  }

  /**
   * Cancel invitation (host only)
   */
  async cancelInvitation(invitationId: string, inviterId: string): Promise<void> {
    try {
      const { error } = await this.getClient()
        .from('room_invitations')
        .delete()
        .eq('id', invitationId)
        .eq('inviter_id', inviterId);

      if (error) {
        console.error('Error cancelling invitation:', error);
        throw new Error(`Failed to cancel invitation: ${error.message}`);
      }
    } catch (error) {
      console.error('Exception in cancelInvitation:', error);
      throw error;
    }
  }
}
