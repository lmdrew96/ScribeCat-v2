/**
 * StudyRoomRealtimeChannels
 *
 * Manages real-time subscriptions for study room participants and invitations.
 */

import { createLogger } from '../../../../shared/logger.js';
import type { RoomInvitationData } from '../../../../domain/entities/RoomInvitation.js';
import { RendererSupabaseClient } from '../../../services/RendererSupabaseClient.js';
import type { RealtimeChannel } from '@supabase/supabase-js';

const logger = createLogger('StudyRoomRealtimeChannels');

export type ParticipantChangeHandler = (payload: any) => void;
export type InvitationChangeHandler = (invitation: RoomInvitationData, eventType: 'INSERT' | 'UPDATE') => void;

export class StudyRoomRealtimeChannels {
  private participantsChannel: RealtimeChannel | null = null;
  private invitationChannel: RealtimeChannel | null = null;
  private invitationUnsubscribe: (() => void) | null = null;
  private currentUserId: string | null = null;

  /**
   * Set current user ID for subscriptions
   */
  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
  }

  /**
   * Subscribe to real-time participant changes
   */
  async subscribeToParticipantChanges(onParticipantChange: ParticipantChangeHandler, retryCount = 0): Promise<void> {
    const MAX_RETRIES = 3;
    try {
      const rendererClient = RendererSupabaseClient.getInstance();
      const supabase = rendererClient.getClient();

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        if (retryCount < MAX_RETRIES) {
          const delay = Math.pow(2, retryCount) * 1000;
          logger.info(`⏳ StudyRoomRealtimeChannels: No session yet for participants, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          setTimeout(() => this.subscribeToParticipantChanges(onParticipantChange, retryCount + 1), delay);
          return;
        }
        logger.warn('⚠️ No session available after retries, skipping participant subscription');
        return;
      }

      logger.info('📡 Creating Realtime participant subscription using RendererSupabaseClient with session');

      this.participantsChannel = supabase
        .channel('room-participants-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'room_participants',
          },
          (payload) => {
            onParticipantChange(payload);
          }
        )
        .subscribe((status, err) => {
          if (err) {
            logger.error('❌ StudyRoomRealtimeChannels: Participant subscription error:', err);
          }
          if (status === 'SUBSCRIBED') {
            logger.info('✅ Subscribed to room participants real-time updates');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            const errorType = status === 'CHANNEL_ERROR' ? 'Channel error' : 'Timed out';
            if (retryCount < MAX_RETRIES) {
              const delay = Math.pow(2, retryCount) * 1000;
              logger.warn(`⚠️ StudyRoomRealtimeChannels: ${errorType} for participants, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
              this.participantsChannel?.unsubscribe();
              this.participantsChannel = null;
              setTimeout(() => this.subscribeToParticipantChanges(onParticipantChange, retryCount + 1), delay);
            } else {
              logger.error(`❌ StudyRoomRealtimeChannels: ${errorType} for participants after ${MAX_RETRIES} retries`);
            }
          }
        });
    } catch (error) {
      logger.error('Exception subscribing to participant changes:', error);
    }
  }

  /**
   * Unsubscribe from real-time participant changes
   */
  unsubscribeFromParticipantChanges(): void {
    if (this.participantsChannel) {
      this.participantsChannel.unsubscribe();
      this.participantsChannel = null;
      logger.info('Unsubscribed from room participants real-time updates');
    }
  }

  /**
   * Subscribe to real-time invitation updates
   */
  async subscribeToInvitations(onInvitationChange: InvitationChangeHandler, retryCount = 0): Promise<void> {
    const MAX_RETRIES = 3;
    try {
      logger.info('🔔 Setting up realtime invitation subscription for user:', this.currentUserId);

      if (!this.currentUserId) {
        logger.error('❌ No user ID available for invitation subscription');
        return;
      }

      const rendererClient = RendererSupabaseClient.getInstance();
      const client = rendererClient.getClient();

      if (!client) {
        logger.error('❌ No Supabase client available in renderer');
        return;
      }

      // Validate session before subscribing
      const { data: { session } } = await client.auth.getSession();
      if (!session) {
        if (retryCount < MAX_RETRIES) {
          const delay = Math.pow(2, retryCount) * 1000;
          logger.info(`⏳ StudyRoomRealtimeChannels: No session yet for invitations, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          setTimeout(() => this.subscribeToInvitations(onInvitationChange, retryCount + 1), delay);
          return;
        }
        logger.warn('⚠️ StudyRoomRealtimeChannels: No session available after retries, skipping invitation subscription');
        return;
      }

      const channelName = `study-room-invitations:${this.currentUserId}`;

      if (this.invitationChannel) {
        logger.info('🔄 Removing existing invitation channel');
        this.invitationChannel.unsubscribe();
        client.removeChannel(this.invitationChannel);
        this.invitationChannel = null;
      }

      logger.info('📡 Creating direct Supabase realtime channel for invitations');

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
            logger.info('🔥 New invitation realtime event:', payload);
            const invitation = this.convertPayloadToInvitation(payload.new);
            onInvitationChange(invitation, 'INSERT');
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
            logger.info('🔥 Invitation update realtime event:', payload);
            const invitation = this.convertPayloadToInvitation(payload.new);
            onInvitationChange(invitation, 'UPDATE');
          }
        );

      this.invitationChannel.subscribe((status, err) => {
        logger.info('📡 Invitation subscription status:', status);
        if (err) {
          logger.error('❌ Invitation subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          logger.info('✅ Successfully subscribed to invitations');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const errorType = status === 'CHANNEL_ERROR' ? 'Channel error' : 'Timed out';
          if (retryCount < MAX_RETRIES) {
            const delay = Math.pow(2, retryCount) * 1000;
            logger.warn(`⚠️ StudyRoomRealtimeChannels: ${errorType} for invitations, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            this.invitationChannel?.unsubscribe();
            client.removeChannel(this.invitationChannel!);
            this.invitationChannel = null;
            setTimeout(() => this.subscribeToInvitations(onInvitationChange, retryCount + 1), delay);
          } else {
            logger.error(`❌ StudyRoomRealtimeChannels: ${errorType} for invitations after ${MAX_RETRIES} retries`);
          }
        } else if (status === 'CLOSED') {
          logger.info('🔒 Invitation subscription channel closed');
        }
      });

      this.invitationUnsubscribe = () => {
        if (this.invitationChannel) {
          logger.info('🔒 Unsubscribing from invitations');
          this.invitationChannel.unsubscribe();
          client.removeChannel(this.invitationChannel);
          this.invitationChannel = null;
        }
      };

      logger.info('✅ Invitation subscription initiated');
    } catch (error) {
      logger.error('❌ Exception subscribing to invitation changes:', error);
    }
  }

  /**
   * Unsubscribe from real-time invitation updates
   */
  unsubscribeFromInvitations(): void {
    if (this.invitationUnsubscribe) {
      this.invitationUnsubscribe();
      this.invitationUnsubscribe = null;
      logger.info('Unsubscribed from invitation real-time updates');
    }
  }

  /**
   * Convert Supabase payload to RoomInvitationData
   */
  private convertPayloadToInvitation(payload: any): RoomInvitationData {
    return {
      id: payload.id,
      roomId: payload.room_id,
      roomName: payload.room_name,
      inviterId: payload.inviter_id,
      inviterEmail: payload.inviter_email,
      inviterFullName: payload.inviter_full_name,
      inviteeId: payload.invitee_id,
      inviteeEmail: payload.invitee_email,
      inviteeFullName: payload.invitee_full_name,
      status: payload.status,
      createdAt: payload.created_at,
      updatedAt: payload.updated_at,
    };
  }

  /**
   * Clean up all subscriptions
   */
  cleanup(): void {
    this.unsubscribeFromParticipantChanges();
    this.unsubscribeFromInvitations();
  }
}
