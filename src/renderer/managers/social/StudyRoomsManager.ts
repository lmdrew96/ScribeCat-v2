/**
 * StudyRoomsManager
 *
 * Manages study rooms, participants, and invitations in the renderer process.
 * Handles real-time participant updates via Supabase Realtime.
 */

import { createLogger } from '../../../shared/logger.js';
import type { StudyRoomData } from '../../../domain/entities/StudyRoom.js';
import type { RoomParticipantData } from '../../../domain/entities/RoomParticipant.js';
import type { RoomInvitationData } from '../../../domain/entities/RoomInvitation.js';
import { RendererSupabaseClient } from '../../services/RendererSupabaseClient.js';
import type { RealtimeChannel } from '@supabase/supabase-js';

const logger = createLogger('StudyRoomsManager');

export type RoomsChangeListener = (rooms: StudyRoomData[]) => void;
export type ParticipantsChangeListener = (roomId: string, participants: RoomParticipantData[]) => void;
export type InvitationsChangeListener = (invitations: RoomInvitationData[]) => void;

/**
 * StudyRoomsManager - Manages study rooms with real-time participant updates
 */
export class StudyRoomsManager {
  private rooms: StudyRoomData[] = [];
  private participants: Map<string, RoomParticipantData[]> = new Map();
  private invitations: RoomInvitationData[] = [];
  private currentUserId: string | null = null;

  private roomsListeners: Set<RoomsChangeListener> = new Set();
  private participantsListeners: Set<ParticipantsChangeListener> = new Set();
  private invitationsListeners: Set<InvitationsChangeListener> = new Set();

  private realtimeChannel: RealtimeChannel | null = null;
  private invitationChannel: RealtimeChannel | null = null;
  private invitationUnsubscribe: (() => void) | null = null;

  // Debounce timers to prevent cascade reloads
  private loadRoomsDebounceTimer: NodeJS.Timeout | null = null;
  private loadParticipantsDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly LOAD_ROOMS_DEBOUNCE_MS = 200;
  private readonly LOAD_PARTICIPANTS_DEBOUNCE_MS = 500;

  constructor() {
    logger.info('StudyRoomsManager initialized');
  }

  /**
   * Initialize the study rooms manager with current user
   */
  async initialize(userId: string): Promise<void> {
    this.currentUserId = userId;
    await this.loadRooms();
    await this.loadInvitations();
    await this.subscribeToParticipantChanges();
    await this.subscribeToInvitations();
    logger.info('StudyRoomsManager initialized for user:', userId);
  }

  /**
   * Clear all data (on sign out)
   */
  clear(): void {
    this.currentUserId = null;
    this.rooms = [];
    this.participants.clear();
    this.invitations = [];

    // Clear debounce timer
    if (this.loadRoomsDebounceTimer) {
      clearTimeout(this.loadRoomsDebounceTimer);
      this.loadRoomsDebounceTimer = null;
    }

    this.unsubscribeFromParticipantChanges();
    this.unsubscribeFromInvitations();
    this.notifyRoomsListeners();
    this.notifyInvitationsListeners();
    logger.info('StudyRoomsManager cleared');
  }

  // ============================================================================
  // Room Operations
  // ============================================================================

  /**
   * Load rooms from the server (debounced to prevent race conditions)
   */
  async loadRooms(): Promise<void> {
    // Clear existing debounce timer
    if (this.loadRoomsDebounceTimer) {
      clearTimeout(this.loadRoomsDebounceTimer);
    }

    // Set new debounce timer
    return new Promise((resolve, reject) => {
      this.loadRoomsDebounceTimer = setTimeout(async () => {
        try {
          await this.loadRoomsImmediate();
          resolve();
        } catch (error) {
          reject(error);
        }
      }, this.LOAD_ROOMS_DEBOUNCE_MS);
    });
  }

  /**
   * Immediately load rooms from the server without debouncing
   * Used internally and for initialization
   */
  private async loadRoomsImmediate(): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.getUserRooms();

      if (result.success) {
        this.rooms = result.rooms || [];

        // Load participants for each room
        for (const room of this.rooms) {
          await this.loadRoomParticipants(room.id);
        }

        this.notifyRoomsListeners();
        logger.info(`Loaded ${this.rooms.length} rooms`);
      } else {
        logger.error('Failed to load rooms:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception loading rooms:', error);
      throw error;
    }
  }

  /**
   * Get all rooms
   */
  getRooms(): StudyRoomData[] {
    return [...this.rooms];
  }

  /**
   * Get active rooms only
   */
  getActiveRooms(): StudyRoomData[] {
    return this.rooms.filter(r => r.isActive);
  }

  /**
   * Get rooms where user is host
   */
  getHostedRooms(): StudyRoomData[] {
    if (!this.currentUserId) return [];
    return this.rooms.filter(r => r.hostId === this.currentUserId);
  }

  /**
   * Get rooms where user is participant (not host)
   */
  getJoinedRooms(): StudyRoomData[] {
    if (!this.currentUserId) return [];
    return this.rooms.filter(r => r.hostId !== this.currentUserId);
  }

  /**
   * Get room by ID
   */
  getRoomById(roomId: string): StudyRoomData | null {
    return this.rooms.find(r => r.id === roomId) || null;
  }

  /**
   * Create a new study room
   */
  async createRoom(params: {
    name: string;
    sessionId: string | null;
    maxParticipants: number;
  }): Promise<StudyRoomData> {
    try {
      const result = await window.scribeCat.studyRooms.createRoom(params);

      if (result.success && result.room) {
        // Add to local state
        this.rooms.push(result.room);
        this.notifyRoomsListeners();

        // Load participants (host is auto-added by trigger)
        await this.loadRoomParticipants(result.room.id);

        logger.info('Room created:', result.room.id);
        return result.room;
      } else {
        logger.error('Failed to create room:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception creating room:', error);
      throw error;
    }
  }

  /**
   * Close a room (host only)
   */
  async closeRoom(roomId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.closeRoom(roomId);

      if (result.success) {
        // Update local state
        const room = this.rooms.find(r => r.id === roomId);
        if (room) {
          room.isActive = false;
          room.closedAt = new Date();
          this.notifyRoomsListeners();
        }

        logger.info('Room closed:', roomId);
      } else {
        logger.error('Failed to close room:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception closing room:', error);
      throw error;
    }
  }

  /**
   * Update room settings (host only)
   */
  async updateRoom(params: {
    roomId: string;
    name?: string;
    maxParticipants?: number;
  }): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.updateRoom(params);

      if (result.success) {
        // Update local state
        const room = this.rooms.find(r => r.id === params.roomId);
        if (room) {
          if (params.name !== undefined) room.name = params.name;
          if (params.maxParticipants !== undefined) room.maxParticipants = params.maxParticipants;
          this.notifyRoomsListeners();
        }

        logger.info('Room updated:', params.roomId);
      } else {
        logger.error('Failed to update room:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception updating room:', error);
      throw error;
    }
  }

  // ============================================================================
  // Participant Operations
  // ============================================================================

  /**
   * Load participants for a specific room
   */
  async loadRoomParticipants(roomId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.getRoomParticipants(roomId);

      if (result.success) {
        this.participants.set(roomId, result.participants || []);
        this.notifyParticipantsListeners(roomId);
        logger.info(`Loaded ${result.participants?.length || 0} participants for room ${roomId}`);
      } else {
        logger.error('Failed to load participants:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception loading participants:', error);
      throw error;
    }
  }

  /**
   * Get participants for a room
   */
  getRoomParticipants(roomId: string): RoomParticipantData[] {
    return [...(this.participants.get(roomId) || [])];
  }

  /**
   * Get active participants only
   */
  getActiveParticipants(roomId: string): RoomParticipantData[] {
    return this.getRoomParticipants(roomId).filter(p => p.isActive);
  }

  /**
   * Get participant count for a room
   */
  getParticipantCount(roomId: string): number {
    return this.getActiveParticipants(roomId).length;
  }

  /**
   * Join a room
   */
  async joinRoom(roomId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.joinRoom(roomId);

      if (result.success) {
        // Reload participants (realtime will also update)
        await this.loadRoomParticipants(roomId);

        // Reload rooms to update participant count
        await this.loadRooms();

        logger.info('Joined room:', roomId);
      } else {
        logger.error('Failed to join room:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception joining room:', error);
      throw error;
    }
  }

  /**
   * Leave a room
   */
  async leaveRoom(roomId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.leaveRoom(roomId);

      if (result.success) {
        // Reload participants (realtime will also update)
        await this.loadRoomParticipants(roomId);

        // Reload rooms to update participant count
        await this.loadRooms();

        logger.info('Left room:', roomId);
      } else {
        logger.error('Failed to leave room:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception leaving room:', error);
      throw error;
    }
  }

  /**
   * Remove a participant from a room (host only)
   */
  async removeParticipant(roomId: string, participantId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.removeParticipant({
        roomId,
        participantId,
      });

      if (result.success) {
        // Reload participants (realtime will also update)
        await this.loadRoomParticipants(roomId);

        logger.info('Removed participant:', participantId);
      } else {
        logger.error('Failed to remove participant:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception removing participant:', error);
      throw error;
    }
  }

  /**
   * Check if current user is in a room
   */
  async isUserInRoom(roomId: string): Promise<boolean> {
    try {
      const result = await window.scribeCat.studyRooms.isUserInRoom(roomId);

      if (result.success) {
        return result.isInRoom || false;
      } else {
        logger.error('Failed to check if user is in room:', result.error);
        return false;
      }
    } catch (error) {
      logger.error('Exception checking if user is in room:', error);
      return false;
    }
  }

  // ============================================================================
  // Invitation Operations
  // ============================================================================

  /**
   * Load invitations from the server
   */
  async loadInvitations(): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.getUserInvitations();

      if (result.success) {
        this.invitations = result.invitations || [];
        this.notifyInvitationsListeners();
        logger.info(`Loaded ${this.invitations.length} invitations`);
      } else {
        logger.error('Failed to load invitations:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception loading invitations:', error);
      throw error;
    }
  }

  /**
   * Get all invitations
   */
  getInvitations(): RoomInvitationData[] {
    return [...this.invitations];
  }

  /**
   * Get pending invitations (received by current user)
   */
  getPendingInvitations(): RoomInvitationData[] {
    if (!this.currentUserId) return [];

    return this.invitations.filter(
      inv => inv.status === 'pending' && inv.inviteeId === this.currentUserId
    );
  }

  /**
   * Get sent invitations (sent by current user)
   */
  getSentInvitations(): RoomInvitationData[] {
    if (!this.currentUserId) return [];

    return this.invitations.filter(
      inv => inv.status === 'pending' && inv.inviterId === this.currentUserId
    );
  }

  /**
   * Get pending invitations count
   */
  getPendingInvitationsCount(): number {
    return this.getPendingInvitations().length;
  }

  /**
   * Send an invitation to join a room
   */
  async sendInvitation(roomId: string, inviteeId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.sendInvitation({
        roomId,
        inviteeId,
      });

      if (result.success && result.invitation) {
        // Add to local state
        this.invitations.push(result.invitation);
        this.notifyInvitationsListeners();

        logger.info('Invitation sent to:', inviteeId);
      } else {
        logger.error('Failed to send invitation:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception sending invitation:', error);
      throw error;
    }
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(invitationId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.acceptInvitation(invitationId);

      if (result.success) {
        // Update local state
        const invitation = this.invitations.find(inv => inv.id === invitationId);
        if (invitation) {
          invitation.status = 'accepted';
          this.notifyInvitationsListeners();

          // Reload rooms to include the new room
          await this.loadRooms();
        }

        logger.info('Invitation accepted:', invitationId);
      } else {
        logger.error('Failed to accept invitation:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception accepting invitation:', error);
      throw error;
    }
  }

  /**
   * Decline an invitation
   */
  async declineInvitation(invitationId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.declineInvitation(invitationId);

      if (result.success) {
        // Update local state
        const invitation = this.invitations.find(inv => inv.id === invitationId);
        if (invitation) {
          invitation.status = 'declined';
          this.notifyInvitationsListeners();
        }

        logger.info('Invitation declined:', invitationId);
      } else {
        logger.error('Failed to decline invitation:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception declining invitation:', error);
      throw error;
    }
  }

  /**
   * Cancel an invitation (sender only)
   */
  async cancelInvitation(invitationId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.cancelInvitation(invitationId);

      if (result.success) {
        // Remove from local state
        this.invitations = this.invitations.filter(inv => inv.id !== invitationId);
        this.notifyInvitationsListeners();

        logger.info('Invitation cancelled:', invitationId);
      } else {
        logger.error('Failed to cancel invitation:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception cancelling invitation:', error);
      throw error;
    }
  }

  // ============================================================================
  // Real-time Subscriptions
  // ============================================================================

  /**
   * Subscribe to real-time participant changes
   */
  private async subscribeToParticipantChanges(): Promise<void> {
    try {
      const rendererClient = RendererSupabaseClient.getInstance();
      const supabase = rendererClient.getClient();

      // Wait for session to be ready
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.warn('⚠️ No session available for Realtime subscription, skipping participant subscription');
        return;
      }

      console.log('📡 Creating Realtime participant subscription using RendererSupabaseClient with session');

      this.realtimeChannel = supabase
        .channel('room-participants-changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'room_participants',
          },
          (payload) => {
            this.handleParticipantChange(payload);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            logger.info('Subscribed to room participants real-time updates');
          } else if (status === 'CHANNEL_ERROR') {
            logger.error('Failed to subscribe to room participants');
          } else if (status === 'TIMED_OUT') {
            logger.error('Subscription to room participants timed out');
          }
        });
    } catch (error) {
      logger.error('Exception subscribing to participant changes:', error);
    }
  }

  /**
   * Unsubscribe from real-time participant changes
   */
  private unsubscribeFromParticipantChanges(): void {
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
      this.realtimeChannel = null;
      logger.info('Unsubscribed from room participants real-time updates');
    }
  }

  /**
   * Subscribe to real-time invitation updates
   */
  private async subscribeToInvitations(): Promise<void> {
    try {
      logger.info('🔔 Setting up realtime invitation subscription for user:', this.currentUserId);
      console.log('🔔 StudyRoomsManager: Starting DIRECT Supabase subscription in renderer...');

      if (!this.currentUserId) {
        console.error('❌ No user ID available for subscription');
        return;
      }

      // Use the renderer Supabase client directly for realtime
      const rendererClient = RendererSupabaseClient.getInstance();
      const client = rendererClient.getClient();

      if (!client) {
        console.error('❌ No Supabase client available in renderer');
        return;
      }

      const channelName = `study-room-invitations:${this.currentUserId}`;

      // Remove any existing subscription
      if (this.invitationChannel) {
        console.log('🔄 Removing existing invitation channel');
        this.invitationChannel.unsubscribe();
        client.removeChannel(this.invitationChannel);
        this.invitationChannel = null;
      }

      console.log('📡 Creating direct Supabase realtime channel in renderer process');

      // Create the realtime channel
      this.invitationChannel = client
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'room_invitations',
            filter: `invitee_id=eq.${this.currentUserId}`,
          },
          (payload) => {
            console.log('🔥 NEW INVITATION REALTIME EVENT IN RENDERER:', payload);

            // Convert payload to RoomInvitationData
            const invitation: RoomInvitationData = {
              id: payload.new.id,
              roomId: payload.new.room_id,
              roomName: payload.new.room_name,
              inviterId: payload.new.inviter_id,
              inviterEmail: payload.new.inviter_email,
              inviterFullName: payload.new.inviter_full_name,
              inviteeId: payload.new.invitee_id,
              inviteeEmail: payload.new.invitee_email,
              inviteeFullName: payload.new.invitee_full_name,
              status: payload.new.status,
              createdAt: payload.new.created_at,
              updatedAt: payload.new.updated_at,
            };

            this.handleInvitationChange(invitation, 'INSERT');
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'room_invitations',
            filter: `invitee_id=eq.${this.currentUserId}`,
          },
          (payload) => {
            console.log('🔥 INVITATION UPDATE REALTIME EVENT IN RENDERER:', payload);

            // Convert payload to RoomInvitationData
            const invitation: RoomInvitationData = {
              id: payload.new.id,
              roomId: payload.new.room_id,
              roomName: payload.new.room_name,
              inviterId: payload.new.inviter_id,
              inviterEmail: payload.new.inviter_email,
              inviterFullName: payload.new.inviter_full_name,
              inviteeId: payload.new.invitee_id,
              inviteeEmail: payload.new.invitee_email,
              inviteeFullName: payload.new.invitee_full_name,
              status: payload.new.status,
              createdAt: payload.new.created_at,
              updatedAt: payload.new.updated_at,
            };

            this.handleInvitationChange(invitation, 'UPDATE');
          }
        );

      // Subscribe and log status
      this.invitationChannel.subscribe((status, err) => {
        console.log('📡 Renderer invitation subscription status:', status);
        if (err) {
          console.error('❌ Renderer subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to invitations in RENDERER process');
          console.log('✅ Realtime WebSocket is now active and waiting for events');
          console.log('📊 Current invitations in manager:', this.invitations);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error in renderer subscription');
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ Subscription timed out in renderer');
        } else if (status === 'CLOSED') {
          console.log('🔒 Subscription channel closed');
        }
      });

      // Store unsubscribe function for cleanup
      this.invitationUnsubscribe = () => {
        if (this.invitationChannel) {
          console.log('🔒 Unsubscribing from invitations');
          this.invitationChannel.unsubscribe();
          client.removeChannel(this.invitationChannel);
          this.invitationChannel = null;
        }
      };

      logger.info('✅ Direct Supabase subscription initiated in renderer');
      console.log('✅ StudyRoomsManager: Direct renderer subscription setup complete');
    } catch (error) {
      logger.error('❌ Exception subscribing to invitation changes:', error);
      console.error('❌ StudyRoomsManager: Failed to subscribe to invitations:', error);
    }
  }

  /**
   * Unsubscribe from real-time invitation updates
   */
  private unsubscribeFromInvitations(): void {
    if (this.invitationUnsubscribe) {
      this.invitationUnsubscribe();
      this.invitationUnsubscribe = null;
      logger.info('Unsubscribed from invitation real-time updates');
    }
  }

  /**
   * Handle real-time invitation change events
   */
  private handleInvitationChange(invitation: RoomInvitationData, eventType: 'INSERT' | 'UPDATE'): void {
    try {
      logger.info('📨 Invitation change event:', eventType, invitation);
      console.log(`📨 handleInvitationChange called: ${eventType}`, invitation);

      if (eventType === 'INSERT') {
        // New invitation received - add to local state
        const existingIndex = this.invitations.findIndex(inv => inv.id === invitation.id);
        if (existingIndex === -1) {
          this.invitations.push(invitation);
          console.log('➕ Added new invitation to local state. Total invitations:', this.invitations.length);
        } else {
          console.log('⚠️ Invitation already exists in local state');
        }
      } else if (eventType === 'UPDATE') {
        // Invitation status updated - update local state
        const existingIndex = this.invitations.findIndex(inv => inv.id === invitation.id);
        if (existingIndex !== -1) {
          this.invitations[existingIndex] = invitation;
          console.log('📝 Updated existing invitation in local state');
        } else {
          console.log('⚠️ Tried to update non-existent invitation');
        }
      }

      console.log('🔔 Notifying', this.invitationsListeners.size, 'invitation listeners');
      this.notifyInvitationsListeners();
    } catch (error) {
      logger.error('Error handling invitation change:', error);
    }
  }

  /**
   * Handle real-time participant change events
   * Debounced to prevent cascade reloads when multiple users join/leave simultaneously
   */
  private handleParticipantChange(payload: any): void {
    try {
      logger.info('Participant change event:', payload.eventType, payload);

      // Extract room_id from the payload
      const roomId = payload.new?.room_id || payload.old?.room_id;
      if (!roomId) {
        logger.warn('Participant change event missing room_id');
        return;
      }

      // Debounce participant reload for this specific room
      const existingTimer = this.loadParticipantsDebounceTimers.get(roomId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        this.loadRoomParticipants(roomId).catch((error) => {
          logger.error('Failed to reload participants after real-time event:', error);
        });
        this.loadParticipantsDebounceTimers.delete(roomId);
      }, this.LOAD_PARTICIPANTS_DEBOUNCE_MS);

      this.loadParticipantsDebounceTimers.set(roomId, timer);

      // Debounce rooms reload (already has built-in debouncing via loadRooms)
      this.loadRooms().catch((error) => {
        logger.error('Failed to reload rooms after real-time event:', error);
      });
    } catch (error) {
      logger.error('Exception handling participant change:', error);
    }
  }

  // ============================================================================
  // Listeners
  // ============================================================================

  /**
   * Add a listener for rooms list changes
   */
  addRoomsListener(listener: RoomsChangeListener): void {
    this.roomsListeners.add(listener);
  }

  /**
   * Remove a rooms list listener
   */
  removeRoomsListener(listener: RoomsChangeListener): void {
    this.roomsListeners.delete(listener);
  }

  /**
   * Notify all rooms listeners
   */
  private notifyRoomsListeners(): void {
    for (const listener of this.roomsListeners) {
      try {
        listener(this.rooms);
      } catch (error) {
        logger.error('Error in rooms listener:', error);
      }
    }
  }

  /**
   * Add a listener for participants changes
   */
  addParticipantsListener(listener: ParticipantsChangeListener): void {
    this.participantsListeners.add(listener);
  }

  /**
   * Remove a participants listener
   */
  removeParticipantsListener(listener: ParticipantsChangeListener): void {
    this.participantsListeners.delete(listener);
  }

  /**
   * Notify all participants listeners for a specific room
   */
  private notifyParticipantsListeners(roomId: string): void {
    const participants = this.participants.get(roomId) || [];
    for (const listener of this.participantsListeners) {
      try {
        listener(roomId, participants);
      } catch (error) {
        logger.error('Error in participants listener:', error);
      }
    }
  }

  /**
   * Add a listener for invitations changes
   */
  addInvitationsListener(listener: InvitationsChangeListener): void {
    this.invitationsListeners.add(listener);
  }

  /**
   * Remove an invitations listener
   */
  removeInvitationsListener(listener: InvitationsChangeListener): void {
    this.invitationsListeners.delete(listener);
  }

  /**
   * Notify all invitations listeners
   */
  private notifyInvitationsListeners(): void {
    for (const listener of this.invitationsListeners) {
      try {
        listener(this.invitations);
      } catch (error) {
        logger.error('Error in invitations listener:', error);
      }
    }
  }

  /**
   * Refresh all data
   */
  async refresh(): Promise<void> {
    await Promise.all([
      this.loadRooms(),
      this.loadInvitations(),
    ]);
  }
}
