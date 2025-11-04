/**
 * CollaborationManager
 *
 * Orchestrates real-time collaboration for shared sessions.
 * Manages Yjs provider lifecycle, presence tracking, and collaboration state.
 *
 * Features:
 * - Enable/disable collaboration for specific sessions
 * - Track active collaborators
 * - Handle connection state changes
 * - Provide collaboration status to UI
 */

import * as Y from 'yjs';
import { SupabaseYjsProvider } from '../../../infrastructure/services/collaboration/SupabaseYjsProvider.js';
import { UserPresence, ConnectionState } from '../../../infrastructure/services/supabase/SupabaseRealtimeService.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('CollaborationManager');

export interface CollaborationConfig {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  avatarUrl?: string;
  isSharedSession: boolean;
  hasEditorPermission: boolean;
}

export interface CollaborationState {
  isCollaborating: boolean;
  connectionState: ConnectionState;
  activeUsers: UserPresence[];
  yjsDoc: Y.Doc | null;
  provider: SupabaseYjsProvider | null;
}

type CollaborationStateChangeHandler = (state: CollaborationState) => void;

export class CollaborationManager {
  private yjsDoc: Y.Doc | null = null;
  private provider: SupabaseYjsProvider | null = null;
  private currentConfig: CollaborationConfig | null = null;
  private state: CollaborationState = {
    isCollaborating: false,
    connectionState: ConnectionState.DISCONNECTED,
    activeUsers: [],
    yjsDoc: null,
    provider: null
  };

  private stateChangeHandlers: Set<CollaborationStateChangeHandler> = new Set();

  constructor() {
    logger.info('CollaborationManager initialized');
  }

  /**
   * Start collaboration for a session
   */
  async startCollaboration(config: CollaborationConfig): Promise<Y.Doc> {
    try {
      // Check if user has permission to collaborate
      if (!config.isSharedSession || !config.hasEditorPermission) {
        throw new Error('User does not have permission to collaborate on this session');
      }

      // Stop any existing collaboration
      if (this.provider) {
        await this.stopCollaboration();
      }

      logger.info(`Starting collaboration for session: ${config.sessionId}`);

      // Create Yjs document
      this.yjsDoc = new Y.Doc();
      this.currentConfig = config;

      // Generate random color for user cursor
      const userColor = this.generateUserColor(config.userId);

      // Create user presence
      const userPresence: UserPresence = {
        userId: config.userId,
        userName: config.userName,
        userEmail: config.userEmail,
        avatarUrl: config.avatarUrl,
        color: userColor,
        lastActive: new Date()
      };

      // Create Yjs provider
      this.provider = new SupabaseYjsProvider(this.yjsDoc, {
        sessionId: config.sessionId,
        user: userPresence,
        autoSave: true,
        saveInterval: 30000 // Save every 30 seconds
      });

      // Set up provider event listeners
      this.setupProviderListeners();

      // Connect to real-time channel
      await this.provider.connect();

      // Update state
      this.updateState({
        isCollaborating: true,
        connectionState: ConnectionState.CONNECTED,
        yjsDoc: this.yjsDoc,
        provider: this.provider
      });

      logger.info(`Collaboration started successfully for session: ${config.sessionId}`);

      return this.yjsDoc;
    } catch (error) {
      logger.error('Failed to start collaboration:', error);

      // Clean up on failure
      await this.stopCollaboration();

      throw new Error(`Failed to start collaboration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop collaboration
   */
  async stopCollaboration(): Promise<void> {
    try {
      logger.info('Stopping collaboration');

      if (this.provider) {
        await this.provider.disconnect();
        this.provider.destroy();
        this.provider = null;
      }

      if (this.yjsDoc) {
        this.yjsDoc.destroy();
        this.yjsDoc = null;
      }

      this.currentConfig = null;

      // Update state
      this.updateState({
        isCollaborating: false,
        connectionState: ConnectionState.DISCONNECTED,
        activeUsers: [],
        yjsDoc: null,
        provider: null
      });

      logger.info('Collaboration stopped successfully');
    } catch (error) {
      logger.error('Error stopping collaboration:', error);
    }
  }

  /**
   * Check if collaboration is active
   */
  isCollaborating(): boolean {
    return this.state.isCollaborating;
  }

  /**
   * Get current collaboration state
   */
  getState(): CollaborationState {
    return { ...this.state };
  }

  /**
   * Get Yjs document (if collaborating)
   */
  getYjsDoc(): Y.Doc | null {
    return this.yjsDoc;
  }

  /**
   * Get active collaborators
   */
  getActiveCollaborators(): UserPresence[] {
    return this.state.activeUsers;
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return this.state.connectionState;
  }

  /**
   * Register a state change handler
   */
  onStateChange(handler: CollaborationStateChangeHandler): () => void {
    this.stateChangeHandlers.add(handler);
    // Return unsubscribe function
    return () => {
      this.stateChangeHandlers.delete(handler);
    };
  }

  /**
   * Update presence data
   */
  async updatePresence(updates: Partial<UserPresence>): Promise<void> {
    if (!this.provider) {
      logger.warn('Cannot update presence: Not collaborating');
      return;
    }

    try {
      await this.provider.getAwareness().setLocalState({
        ...this.provider.getAwareness().getLocalState(),
        ...updates
      });
    } catch (error) {
      logger.error('Failed to update presence:', error);
    }
  }

  /**
   * Setup provider event listeners
   */
  private setupProviderListeners(): void {
    if (!this.provider) return;

    const realtimeService = (this.provider as any).realtimeService;
    if (!realtimeService) return;

    // Listen for connection state changes
    realtimeService.onConnectionStateChange((state: ConnectionState) => {
      logger.info(`Collaboration connection state changed: ${state}`);
      this.updateState({ connectionState: state });
    });

    // Listen for presence changes
    realtimeService.onPresenceChange((users: UserPresence[]) => {
      logger.info(`Active collaborators changed: ${users.length} users`);
      this.updateState({ activeUsers: users });
    });
  }

  /**
   * Update collaboration state and notify handlers
   */
  private updateState(updates: Partial<CollaborationState>): void {
    this.state = {
      ...this.state,
      ...updates
    };

    // Notify all state change handlers
    this.stateChangeHandlers.forEach(handler => {
      try {
        handler(this.state);
      } catch (error) {
        logger.error('Error in state change handler:', error);
      }
    });
  }

  /**
   * Generate a consistent color for a user based on their ID
   */
  private generateUserColor(userId: string): string {
    // Simple hash function to generate consistent color from user ID
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Convert to hue (0-360)
    const hue = hash % 360;

    // Return HSL color with good saturation and lightness for visibility
    return `hsl(${hue}, 70%, 50%)`;
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.stopCollaboration();
    this.stateChangeHandlers.clear();
    logger.info('CollaborationManager destroyed');
  }
}
