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
  async subscribeToParticipantChanges(onParticipantChange: ParticipantChangeHandler): Promise<void> {
    try {
      const rendererClient = RendererSupabaseClient.getInstance();
      const supabase = rendererClient.getClient();

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.warn('⚠️ No session available for Realtime subscription, skipping participant subscription');
        return;
      }

      console.log('📡 Creating Realtime participant subscription using RendererSupabaseClient with session');

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
  async subscribeToInvitations(onInvitationChange: InvitationChangeHandler): Promise<void> {
    try {
      logger.info('🔔 Setting up realtime invitation subscription for user:', this.currentUserId);
      console.log('🔔 StudyRoomRealtimeChannels: Starting DIRECT Supabase subscription in renderer...');

      if (!this.currentUserId) {
        console.error('❌ No user ID available for subscription');
        return;
      }

      const rendererClient = RendererSupabaseClient.getInstance();
      const client = rendererClient.getClient();

      if (!client) {
        console.error('❌ No Supabase client available in renderer');
        return;
      }

      const channelName = `study-room-invitations:${this.currentUserId}`;

      if (this.invitationChannel) {
        console.log('🔄 Removing existing invitation channel');
        this.invitationChannel.unsubscribe();
        client.removeChannel(this.invitationChannel);
        this.invitationChannel = null;
      }

      console.log('📡 Creating direct Supabase realtime channel in renderer process');

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
            console.log('🔥 INVITATION UPDATE REALTIME EVENT IN RENDERER:', payload);
            const invitation = this.convertPayloadToInvitation(payload.new);
            onInvitationChange(invitation, 'UPDATE');
          }
        );

      this.invitationChannel.subscribe((status, err) => {
        console.log('📡 Renderer invitation subscription status:', status);
        if (err) {
          console.error('❌ Renderer subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to invitations in RENDERER process');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error in renderer subscription');
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ Subscription timed out in renderer');
        } else if (status === 'CLOSED') {
          console.log('🔒 Subscription channel closed');
        }
      });

      this.invitationUnsubscribe = () => {
        if (this.invitationChannel) {
          console.log('🔒 Unsubscribing from invitations');
          this.invitationChannel.unsubscribe();
          client.removeChannel(this.invitationChannel);
          this.invitationChannel = null;
        }
      };

      logger.info('✅ Direct Supabase subscription initiated in renderer');
    } catch (error) {
      logger.error('❌ Exception subscribing to invitation changes:', error);
      console.error('❌ StudyRoomRealtimeChannels: Failed to subscribe to invitations:', error);
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
