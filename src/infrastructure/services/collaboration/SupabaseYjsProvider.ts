/**
 * SupabaseYjsProvider
 *
 * Bridges Yjs documents with Supabase Realtime for collaborative editing.
 * Synchronizes document updates between multiple clients in real-time.
 *
 * Architecture:
 * - Listens for local Yjs document changes
 * - Broadcasts updates via SupabaseRealtimeService
 * - Applies remote updates to local Yjs document
 * - Manages awareness (cursor positions, user selections)
 * - Persists Yjs state to database for recovery
 */

import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import { SupabaseRealtimeService, UserPresence, ConnectionState } from '../supabase/SupabaseRealtimeService.js';
import { SupabaseClient } from '../supabase/SupabaseClient.js';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

export interface YjsProviderOptions {
  sessionId: string;
  user: UserPresence;
  autoSave?: boolean; // Auto-save to database (default: true)
  saveInterval?: number; // Save interval in ms (default: 30000)
}

export class SupabaseYjsProvider {
  private doc: Y.Doc;
  private awareness: Awareness;
  private realtimeService: SupabaseRealtimeService;
  private options: Required<YjsProviderOptions>;

  // State tracking
  private connected: boolean = false;
  private synced: boolean = false;
  private saveInterval: NodeJS.Timeout | null = null;

  // Unsubscribe functions
  private unsubscribeMessage?: () => void;
  private unsubscribePresence?: () => void;
  private unsubscribeConnection?: () => void;

  constructor(doc: Y.Doc, options: YjsProviderOptions) {
    this.doc = doc;
    this.options = {
      ...options,
      autoSave: options.autoSave !== false,
      saveInterval: options.saveInterval || 30000
    };

    // Initialize awareness (for cursor positions, selections, etc.)
    this.awareness = new Awareness(doc);
    this.awareness.setLocalState({
      user: options.user,
      cursor: null,
      selection: null
    });

    // Initialize realtime service
    this.realtimeService = new SupabaseRealtimeService();

    // Set up event listeners
    this.setupDocumentListeners();
    this.setupAwarenessListeners();
  }

  /**
   * Connect to the collaborative session
   */
  async connect(): Promise<void> {
    try {
      // Load initial state from database
      await this.loadInitialState();

      // Connect to real-time channel
      await this.realtimeService.connect(this.options.sessionId, this.options.user);
      this.connected = true;

      // Set up real-time event handlers
      this.setupRealtimeHandlers();

      // Start auto-save if enabled
      if (this.options.autoSave) {
        this.startAutoSave();
      }

      console.log(`✅ Yjs provider connected for session: ${this.options.sessionId}`);
    } catch (error) {
      console.error('Failed to connect Yjs provider:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the collaborative session
   */
  async disconnect(): Promise<void> {
    try {
      // Save final state before disconnecting
      if (this.options.autoSave) {
        await this.saveState();
        this.stopAutoSave();
      }

      // Clean up realtime subscriptions
      if (this.unsubscribeMessage) this.unsubscribeMessage();
      if (this.unsubscribePresence) this.unsubscribePresence();
      if (this.unsubscribeConnection) this.unsubscribeConnection();

      // Disconnect from realtime service
      await this.realtimeService.disconnect();

      this.connected = false;
      this.synced = false;

      console.log('✅ Yjs provider disconnected');
    } catch (error) {
      console.error('Error disconnecting Yjs provider:', error);
    }
  }

  /**
   * Get the awareness instance
   */
  getAwareness(): Awareness {
    return this.awareness;
  }

  /**
   * Check if provider is connected
   */
  isConnected(): boolean {
    return this.connected && this.realtimeService.isConnected();
  }

  /**
   * Check if document is synced
   */
  isSynced(): boolean {
    return this.synced;
  }

  /**
   * Manually trigger a save to database
   */
  async save(): Promise<void> {
    await this.saveState();
  }

  /**
   * Setup document update listeners
   */
  private setupDocumentListeners(): void {
    // Listen for local document updates
    this.doc.on('update', this.handleLocalUpdate);
  }

  /**
   * Setup awareness listeners
   */
  private setupAwarenessListeners(): void {
    // Listen for awareness changes (cursor, selection)
    this.awareness.on('change', this.handleAwarenessChange);
  }

  /**
   * Setup realtime event handlers
   */
  private setupRealtimeHandlers(): void {
    // Handle incoming messages from other clients
    this.unsubscribeMessage = this.realtimeService.onMessage((message) => {
      if (message.type === 'yjs-update') {
        this.handleRemoteUpdate(message.payload);
      } else if (message.type === 'yjs-awareness') {
        this.handleRemoteAwareness(message.payload);
      }
    });

    // Handle presence changes
    this.unsubscribePresence = this.realtimeService.onPresenceChange((users) => {
      // Update awareness with current users
      console.log(`Active collaborators: ${users.length}`);
    });

    // Handle connection state changes
    this.unsubscribeConnection = this.realtimeService.onConnectionStateChange((state) => {
      if (state === ConnectionState.CONNECTED) {
        this.connected = true;
        // Broadcast our current document state to sync with others
        this.broadcastSyncStep1();
      } else if (state === ConnectionState.DISCONNECTED || state === ConnectionState.ERROR) {
        this.connected = false;
        this.synced = false;
      }
    });
  }

  /**
   * Handle local document updates
   */
  private handleLocalUpdate = (update: Uint8Array, origin: any): void => {
    // Don't broadcast updates that came from remote (origin === this)
    if (origin === this) {
      return;
    }

    // Broadcast update to other clients
    if (this.connected) {
      this.broadcastUpdate(update);
    }
  };

  /**
   * Handle local awareness changes
   */
  private handleAwarenessChange = ({ added, updated, removed }: any): void => {
    // Broadcast awareness changes
    if (this.connected) {
      const changedClients = added.concat(updated).concat(removed);
      const awarenessUpdate = encodeAwarenessUpdate(this.awareness, changedClients);

      this.realtimeService.broadcast('yjs-awareness', {
        update: Array.from(awarenessUpdate)
      });
    }
  };

  /**
   * Broadcast a document update to other clients
   */
  private async broadcastUpdate(update: Uint8Array): Promise<void> {
    try {
      await this.realtimeService.broadcast('yjs-update', {
        update: Array.from(update)
      });
    } catch (error) {
      console.error('Failed to broadcast update:', error);
    }
  }

  /**
   * Broadcast sync step 1 (send our state vector)
   */
  private async broadcastSyncStep1(): Promise<void> {
    try {
      const stateVector = Y.encodeStateVector(this.doc);
      await this.realtimeService.broadcast('yjs-update', {
        update: Array.from(stateVector),
        syncStep: 1
      });
    } catch (error) {
      console.error('Failed to broadcast sync step 1:', error);
    }
  }

  /**
   * Handle remote document update
   */
  private handleRemoteUpdate(payload: any): void {
    try {
      const update = new Uint8Array(payload.update);

      // Apply remote update to local document
      // Pass 'this' as origin to prevent re-broadcasting
      Y.applyUpdate(this.doc, update, this);

      // Mark as synced after first update
      if (!this.synced) {
        this.synced = true;
        console.log('✅ Document synced with remote state');
      }
    } catch (error) {
      console.error('Error applying remote update:', error);
    }
  }

  /**
   * Handle remote awareness update
   */
  private handleRemoteAwareness(payload: any): void {
    try {
      const update = new Uint8Array(payload.update);
      applyAwarenessUpdate(this.awareness, update, this);
    } catch (error) {
      console.error('Error applying remote awareness:', error);
    }
  }

  /**
   * Load initial document state from database
   */
  private async loadInitialState(): Promise<void> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data, error } = await client
        .from('yjs_state')
        .select('state_vector')
        .eq('session_id', this.options.sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No saved state found - this is a new document
          console.log('No saved Yjs state found - starting with empty document');
          return;
        }
        throw new Error(`Failed to load Yjs state: ${error.message}`);
      }

      if (data?.state_vector) {
        // Apply saved state to document
        const stateVector = new Uint8Array(data.state_vector);
        Y.applyUpdate(this.doc, stateVector, this);
        console.log('✅ Loaded Yjs state from database');
      }
    } catch (error) {
      console.error('Error loading initial state:', error);
      // Don't throw - allow connection to proceed with empty document
    }
  }

  /**
   * Save current document state to database
   */
  private async saveState(): Promise<void> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // Encode document as state update
      const stateVector = Y.encodeStateAsUpdate(this.doc);

      // Upsert to database
      const { error } = await client
        .from('yjs_state')
        .upsert({
          session_id: this.options.sessionId,
          state_vector: stateVector,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'session_id'
        });

      if (error) {
        throw new Error(`Failed to save Yjs state: ${error.message}`);
      }

      console.log('✅ Saved Yjs state to database');
    } catch (error) {
      console.error('Error saving Yjs state:', error);
      // Don't throw - saving is not critical for real-time functionality
    }
  }

  /**
   * Start auto-save interval
   */
  private startAutoSave(): void {
    if (this.saveInterval) {
      return; // Already started
    }

    this.saveInterval = setInterval(() => {
      if (this.connected) {
        this.saveState().catch(error => {
          console.error('Auto-save failed:', error);
        });
      }
    }, this.options.saveInterval);

    console.log(`✅ Auto-save started (interval: ${this.options.saveInterval}ms)`);
  }

  /**
   * Stop auto-save interval
   */
  private stopAutoSave(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
      console.log('✅ Auto-save stopped');
    }
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.disconnect();
    this.doc.off('update', this.handleLocalUpdate);
    this.awareness.off('change', this.handleAwarenessChange);
    this.realtimeService.destroy();
  }
}
