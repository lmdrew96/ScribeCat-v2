/**
 * SupabaseRealtimeService
 *
 * Manages Supabase Realtime connections for collaborative editing.
 * Handles channel subscriptions, broadcasts, and presence tracking.
 *
 * Features:
 * - Session-specific channels for data isolation
 * - Broadcast Yjs updates to collaborators
 * - Track user presence (online/offline)
 * - Handle connection state changes
 * - Automatic reconnection with exponential backoff
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseClient } from './SupabaseClient.js';

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

export interface UserPresence {
  userId: string;
  userName: string;
  userEmail: string;
  avatarUrl?: string;
  color: string;
  lastActive: Date;
  isTyping?: boolean;
}

export interface RealtimeMessage {
  type: 'yjs-update' | 'yjs-awareness' | 'cursor-update';
  payload: any;
  senderId: string;
  timestamp: Date;
}

type MessageHandler = (message: RealtimeMessage) => void;
type PresenceChangeHandler = (users: UserPresence[]) => void;
type ConnectionStateHandler = (state: ConnectionState) => void;

export class SupabaseRealtimeService {
  private channel: RealtimeChannel | null = null;
  private sessionId: string | null = null;
  private currentUser: UserPresence | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;

  // Event handlers
  private messageHandlers: Set<MessageHandler> = new Set();
  private presenceHandlers: Set<PresenceChangeHandler> = new Set();
  private connectionStateHandlers: Set<ConnectionStateHandler> = new Set();

  // Reconnection logic
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // Service is initialized but not connected until connect() is called
  }

  /**
   * Connect to a session's real-time channel
   */
  async connect(sessionId: string, user: UserPresence): Promise<void> {
    try {
      // Disconnect from any existing channel
      if (this.channel) {
        await this.disconnect();
      }

      this.sessionId = sessionId;
      this.currentUser = user;
      this.updateConnectionState(ConnectionState.CONNECTING);

      const client = SupabaseClient.getInstance().getClient();

      // Create session-specific channel
      const channelName = `session:${sessionId}`;
      this.channel = client.channel(channelName, {
        config: {
          broadcast: {
            ack: true, // Require acknowledgment for reliability
            self: false // Don't receive our own broadcasts
          },
          presence: {
            key: user.userId
          }
        }
      });

      // Set up event handlers
      this.setupChannelHandlers();

      // Subscribe to the channel
      await new Promise<void>((resolve, reject) => {
        if (!this.channel) {
          reject(new Error('Channel not initialized'));
          return;
        }

        this.channel
          .on('broadcast', { event: 'message' }, (payload) => {
            this.handleIncomingMessage(payload);
          })
          .on('presence', { event: 'sync' }, () => {
            this.handlePresenceSync();
          })
          .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            this.handlePresenceJoin(newPresences);
          })
          .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            this.handlePresenceLeave(leftPresences);
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              // Track our presence
              if (this.channel && this.currentUser) {
                await this.channel.track(this.currentUser as any);
              }
              this.updateConnectionState(ConnectionState.CONNECTED);
              this.reconnectAttempts = 0; // Reset on successful connection
              resolve();
            } else if (status === 'CHANNEL_ERROR') {
              this.updateConnectionState(ConnectionState.ERROR);
              reject(new Error('Failed to subscribe to channel'));
            } else if (status === 'TIMED_OUT') {
              this.updateConnectionState(ConnectionState.ERROR);
              reject(new Error('Subscription timed out'));
            }
          });
      });

      console.log(`✅ Connected to real-time channel: ${channelName}`);
    } catch (error) {
      console.error('Failed to connect to real-time channel:', error);
      this.updateConnectionState(ConnectionState.ERROR);

      // Attempt reconnection with exponential backoff
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }

      throw error;
    }
  }

  /**
   * Disconnect from the current channel
   */
  async disconnect(): Promise<void> {
    try {
      // Clear reconnect timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      if (this.channel) {
        // Untrack presence before leaving
        if (this.currentUser) {
          await this.channel.untrack();
        }

        await this.channel.unsubscribe();
        this.channel = null;
      }

      this.sessionId = null;
      this.currentUser = null;
      this.updateConnectionState(ConnectionState.DISCONNECTED);

      console.log('✅ Disconnected from real-time channel');
    } catch (error) {
      console.error('Error disconnecting from channel:', error);
    }
  }

  /**
   * Broadcast a message to all collaborators
   */
  async broadcast(type: RealtimeMessage['type'], payload: any): Promise<void> {
    if (!this.channel || !this.currentUser) {
      console.warn('Cannot broadcast: Not connected to a channel');
      return;
    }

    try {
      const message: RealtimeMessage = {
        type,
        payload,
        senderId: this.currentUser.userId,
        timestamp: new Date()
      };

      await this.channel.send({
        type: 'broadcast',
        event: 'message',
        payload: message
      });
    } catch (error) {
      console.error('Failed to broadcast message:', error);
      throw error;
    }
  }

  /**
   * Update user presence data
   */
  async updatePresence(updates: Partial<UserPresence>): Promise<void> {
    if (!this.channel || !this.currentUser) {
      console.warn('Cannot update presence: Not connected to a channel');
      return;
    }

    this.currentUser = {
      ...this.currentUser,
      ...updates,
      lastActive: new Date()
    };

    await this.channel.track(this.currentUser as any);
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }

  /**
   * Get all users currently present in the channel
   */
  getPresence(): UserPresence[] {
    if (!this.channel) {
      return [];
    }

    const presenceState = this.channel.presenceState();
    const users: UserPresence[] = [];

    for (const userId in presenceState) {
      const presences = presenceState[userId];
      if (presences && presences.length > 0) {
        users.push(presences[0] as unknown as UserPresence);
      }
    }

    return users;
  }

  /**
   * Register a message handler
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    // Return unsubscribe function
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Register a presence change handler
   */
  onPresenceChange(handler: PresenceChangeHandler): () => void {
    this.presenceHandlers.add(handler);
    // Return unsubscribe function
    return () => {
      this.presenceHandlers.delete(handler);
    };
  }

  /**
   * Register a connection state change handler
   */
  onConnectionStateChange(handler: ConnectionStateHandler): () => void {
    this.connectionStateHandlers.add(handler);
    // Return unsubscribe function
    return () => {
      this.connectionStateHandlers.delete(handler);
    };
  }

  /**
   * Setup channel event handlers
   */
  private setupChannelHandlers(): void {
    if (!this.channel) return;

    // Handle connection state changes
    this.channel.on('system', {}, (payload) => {
      if (payload.status === 'ok') {
        this.updateConnectionState(ConnectionState.CONNECTED);
      }
    });
  }

  /**
   * Handle incoming messages from other clients
   */
  private handleIncomingMessage(payload: any): void {
    try {
      const message = payload.payload as RealtimeMessage;

      // Don't process our own messages (should be filtered by self: false)
      if (message.senderId === this.currentUser?.userId) {
        return;
      }

      // Notify all message handlers
      this.messageHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      });
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  /**
   * Handle presence sync event
   */
  private handlePresenceSync(): void {
    const users = this.getPresence();
    this.notifyPresenceHandlers(users);
  }

  /**
   * Handle user joining
   */
  private handlePresenceJoin(newPresences: any[]): void {
    console.log('Users joined:', newPresences.length);
    const users = this.getPresence();
    this.notifyPresenceHandlers(users);
  }

  /**
   * Handle user leaving
   */
  private handlePresenceLeave(leftPresences: any[]): void {
    console.log('Users left:', leftPresences.length);
    const users = this.getPresence();
    this.notifyPresenceHandlers(users);
  }

  /**
   * Notify all presence handlers
   */
  private notifyPresenceHandlers(users: UserPresence[]): void {
    this.presenceHandlers.forEach(handler => {
      try {
        handler(users);
      } catch (error) {
        console.error('Error in presence handler:', error);
      }
    });
  }

  /**
   * Update connection state and notify handlers
   */
  private updateConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) {
      return; // No change
    }

    this.connectionState = state;
    console.log(`Connection state changed: ${state}`);

    // Notify all connection state handlers
    this.connectionStateHandlers.forEach(handler => {
      try {
        handler(state);
      } catch (error) {
        console.error('Error in connection state handler:', error);
      }
    });
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return; // Already scheduled
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Max 30 seconds

    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    this.updateConnectionState(ConnectionState.RECONNECTING);

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;

      if (this.sessionId && this.currentUser) {
        try {
          await this.connect(this.sessionId, this.currentUser);
        } catch (error) {
          console.error('Reconnection attempt failed:', error);
          // scheduleReconnect will be called again by connect() on failure
        }
      }
    }, delay);
  }

  /**
   * Clean up all handlers and connections
   */
  destroy(): void {
    this.disconnect();
    this.messageHandlers.clear();
    this.presenceHandlers.clear();
    this.connectionStateHandlers.clear();
  }
}
