/**
 * StudyRoomsManager
 *
 * Manages study rooms, participants, and invitations in the renderer process.
 * Delegates real-time subscriptions and invitation operations to specialized modules.
 */

import { createLogger } from '../../../shared/logger.js';
import type { StudyRoomData } from '../../../domain/entities/StudyRoom.js';
import type { RoomParticipantData } from '../../../domain/entities/RoomParticipant.js';
import type { RoomInvitationData } from '../../../domain/entities/RoomInvitation.js';
import {
  StudyRoomRealtimeChannels,
  StudyRoomInvitationOps,
} from './study-rooms/index.js';

const logger = createLogger('StudyRoomsManager');

export type RoomsChangeListener = (rooms: StudyRoomData[]) => void;
export type ParticipantsChangeListener = (roomId: string, participants: RoomParticipantData[]) => void;
export type InvitationsChangeListener = (invitations: RoomInvitationData[]) => void;

export class StudyRoomsManager {
  private rooms: StudyRoomData[] = [];
  private rejoinableRooms: StudyRoomData[] = [];
  private participants: Map<string, RoomParticipantData[]> = new Map();
  private invitations: RoomInvitationData[] = [];
  private currentUserId: string | null = null;

  private roomsListeners: Set<RoomsChangeListener> = new Set();
  private participantsListeners: Set<ParticipantsChangeListener> = new Set();
  private invitationsListeners: Set<InvitationsChangeListener> = new Set();

  // Delegated modules
  private realtimeChannels: StudyRoomRealtimeChannels;
  private invitationOps: StudyRoomInvitationOps;

  // Debounce timers
  private loadRoomsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private loadParticipantsDebounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly LOAD_ROOMS_DEBOUNCE_MS = 200;
  private readonly LOAD_PARTICIPANTS_DEBOUNCE_MS = 500;

  constructor() {
    this.realtimeChannels = new StudyRoomRealtimeChannels();
    this.invitationOps = new StudyRoomInvitationOps({
      getCurrentUserId: () => this.currentUserId,
      getInvitations: () => this.invitations,
      setInvitations: (invs) => { this.invitations = invs; },
      notifyInvitationsListeners: () => this.notifyInvitationsListeners(),
      loadRooms: () => this.loadRooms(),
    });
    logger.info('StudyRoomsManager initialized');
  }

  /**
   * Initialize the study rooms manager with current user
   */
  async initialize(userId: string): Promise<void> {
    this.currentUserId = userId;
    this.realtimeChannels.setCurrentUserId(userId);

    await this.loadRooms();
    await this.invitationOps.loadInvitations();
    await this.realtimeChannels.subscribeToParticipantChanges((payload) => this.handleParticipantChange(payload));
    await this.realtimeChannels.subscribeToInvitations((invitation, eventType) =>
      this.invitationOps.handleInvitationChange(invitation, eventType)
    );

    logger.info('StudyRoomsManager initialized for user:', userId);
  }

  /**
   * Clear all data (on sign out)
   */
  clear(): void {
    this.currentUserId = null;
    this.rooms = [];
    this.rejoinableRooms = [];
    this.participants.clear();
    this.invitations = [];

    if (this.loadRoomsDebounceTimer) {
      clearTimeout(this.loadRoomsDebounceTimer);
      this.loadRoomsDebounceTimer = null;
    }

    this.realtimeChannels.cleanup();
    this.notifyRoomsListeners();
    this.notifyInvitationsListeners();
    logger.info('StudyRoomsManager cleared');
  }

  // ============================================================================
  // Room Operations
  // ============================================================================

  async loadRooms(): Promise<void> {
    if (this.loadRoomsDebounceTimer) {
      clearTimeout(this.loadRoomsDebounceTimer);
    }

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

  private async loadRoomsImmediate(): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.getUserRooms();

      if (result.success) {
        this.rooms = result.rooms || [];

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

  async loadRejoinableRooms(): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.getRejoinableRooms();

      if (result.success) {
        this.rejoinableRooms = result.rooms || [];
        this.notifyRoomsListeners();
        logger.info(`Loaded ${this.rejoinableRooms.length} rejoinable rooms`);
      } else {
        logger.error('Failed to load rejoinable rooms:', result.error);
      }
    } catch (error) {
      logger.error('Exception loading rejoinable rooms:', error);
    }
  }

  getRooms(): StudyRoomData[] { return [...this.rooms]; }
  getActiveRooms(): StudyRoomData[] { return this.rooms.filter(r => r.isActive); }
  getRejoinableRooms(): StudyRoomData[] { return [...this.rejoinableRooms]; }
  getHostedRooms(): StudyRoomData[] {
    if (!this.currentUserId) return [];
    return this.rooms.filter(r => r.hostId === this.currentUserId);
  }
  getJoinedRooms(): StudyRoomData[] {
    if (!this.currentUserId) return [];
    return this.rooms.filter(r => r.hostId !== this.currentUserId);
  }
  getRoomById(roomId: string): StudyRoomData | null {
    return this.rooms.find(r => r.id === roomId) || null;
  }

  async createRoom(params: { name: string; sessionId: string | null; maxParticipants: number }): Promise<StudyRoomData> {
    try {
      const result = await window.scribeCat.studyRooms.createRoom(params);

      if (result.success && result.room) {
        this.rooms.push(result.room);
        this.notifyRoomsListeners();
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

  async closeRoom(roomId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.closeRoom(roomId);

      if (result.success) {
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

  async updateRoom(params: { roomId: string; name?: string; maxParticipants?: number }): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.updateRoom(params);

      if (result.success) {
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

  getRoomParticipants(roomId: string): RoomParticipantData[] {
    return [...(this.participants.get(roomId) || [])];
  }

  getActiveParticipants(roomId: string): RoomParticipantData[] {
    return this.getRoomParticipants(roomId).filter(p => p.isActive);
  }

  getParticipantCount(roomId: string): number {
    return this.getActiveParticipants(roomId).length;
  }

  async joinRoom(roomId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.joinRoom(roomId);

      if (result.success) {
        await this.loadRoomParticipants(roomId);
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

  async leaveRoom(roomId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.leaveRoom(roomId);

      if (result.success) {
        await this.loadRoomParticipants(roomId);
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

  async removeParticipant(roomId: string, participantId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.removeParticipant({ roomId, participantId });

      if (result.success) {
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

  async isUserInRoom(roomId: string): Promise<boolean> {
    try {
      const result = await window.scribeCat.studyRooms.isUserInRoom(roomId);
      return result.success ? (result.isInRoom || false) : false;
    } catch (error) {
      logger.error('Exception checking if user is in room:', error);
      return false;
    }
  }

  // ============================================================================
  // Invitation Operations (delegated)
  // ============================================================================

  async loadInvitations(): Promise<void> { return this.invitationOps.loadInvitations(); }
  getInvitations(): RoomInvitationData[] { return [...this.invitations]; }
  getPendingInvitations(): RoomInvitationData[] { return this.invitationOps.getPendingInvitations(); }
  getSentInvitations(): RoomInvitationData[] { return this.invitationOps.getSentInvitations(); }
  getPendingInvitationsCount(): number { return this.invitationOps.getPendingInvitationsCount(); }

  async sendInvitation(roomId: string, inviteeId: string): Promise<void> {
    return this.invitationOps.sendInvitation(roomId, inviteeId);
  }
  async acceptInvitation(invitationId: string): Promise<void> {
    return this.invitationOps.acceptInvitation(invitationId);
  }
  async declineInvitation(invitationId: string): Promise<void> {
    return this.invitationOps.declineInvitation(invitationId);
  }
  async cancelInvitation(invitationId: string): Promise<void> {
    return this.invitationOps.cancelInvitation(invitationId);
  }

  // ============================================================================
  // Real-time Event Handlers
  // ============================================================================

  private handleParticipantChange(payload: any): void {
    try {
      logger.info('Participant change event:', payload.eventType, payload);

      const roomId = payload.new?.room_id || payload.old?.room_id;
      if (!roomId) {
        logger.warn('Participant change event missing room_id');
        return;
      }

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

  addRoomsListener(listener: RoomsChangeListener): void { this.roomsListeners.add(listener); }
  removeRoomsListener(listener: RoomsChangeListener): void { this.roomsListeners.delete(listener); }

  private notifyRoomsListeners(): void {
    for (const listener of this.roomsListeners) {
      try { listener(this.rooms); } catch (error) { logger.error('Error in rooms listener:', error); }
    }
  }

  addParticipantsListener(listener: ParticipantsChangeListener): void { this.participantsListeners.add(listener); }
  removeParticipantsListener(listener: ParticipantsChangeListener): void { this.participantsListeners.delete(listener); }

  private notifyParticipantsListeners(roomId: string): void {
    const participants = this.participants.get(roomId) || [];
    for (const listener of this.participantsListeners) {
      try { listener(roomId, participants); } catch (error) { logger.error('Error in participants listener:', error); }
    }
  }

  addInvitationsListener(listener: InvitationsChangeListener): void { this.invitationsListeners.add(listener); }
  removeInvitationsListener(listener: InvitationsChangeListener): void { this.invitationsListeners.delete(listener); }

  private notifyInvitationsListeners(): void {
    for (const listener of this.invitationsListeners) {
      try { listener(this.invitations); } catch (error) { logger.error('Error in invitations listener:', error); }
    }
  }

  async refresh(): Promise<void> {
    await Promise.all([
      this.loadRooms(),
      this.invitationOps.loadInvitations(),
      this.loadRejoinableRooms(),
    ]);
  }
}
