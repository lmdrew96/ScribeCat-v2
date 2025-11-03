/**
 * EventBus
 *
 * Centralized event bus for decoupling components.
 * Implements publish-subscribe pattern for application-wide event handling.
 */

import { createLogger } from './logger.js';

const logger = createLogger('EventBus');

type EventHandler = (...args: any[]) => void;

export class EventBus {
  private static instance: EventBus;
  private events: Map<string, Set<EventHandler>> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Subscribe to an event
   */
  on(event: string, handler: EventHandler): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }

    this.events.get(event)!.add(handler);
    logger.debug(`Subscribed to event: ${event}`);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Subscribe to an event (one-time)
   */
  once(event: string, handler: EventHandler): void {
    const wrappedHandler = (...args: any[]) => {
      handler(...args);
      this.off(event, wrappedHandler);
    };

    this.on(event, wrappedHandler);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler);
      logger.debug(`Unsubscribed from event: ${event}`);

      // Clean up empty sets
      if (handlers.size === 0) {
        this.events.delete(event);
      }
    }
  }

  /**
   * Emit an event
   */
  emit(event: string, ...args: any[]): void {
    const handlers = this.events.get(event);
    if (handlers) {
      logger.debug(`Emitting event: ${event}`, { handlerCount: handlers.size });
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          logger.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Clear all event handlers for a specific event
   */
  clear(event?: string): void {
    if (event) {
      this.events.delete(event);
      logger.debug(`Cleared all handlers for event: ${event}`);
    } else {
      this.events.clear();
      logger.debug('Cleared all event handlers');
    }
  }

  /**
   * Get all registered events
   */
  getEvents(): string[] {
    return Array.from(this.events.keys());
  }

  /**
   * Get handler count for an event
   */
  getHandlerCount(event: string): number {
    return this.events.get(event)?.size || 0;
  }
}

/**
 * Export singleton instance
 */
export const eventBus = EventBus.getInstance();

/**
 * Event names enum for type safety
 */
export enum AppEvents {
  // Recording events
  RECORDING_STARTED = 'recording:started',
  RECORDING_STOPPED = 'recording:stopped',
  RECORDING_PAUSED = 'recording:paused',
  RECORDING_RESUMED = 'recording:resumed',

  // Transcription events
  TRANSCRIPTION_SEGMENT = 'transcription:segment',
  TRANSCRIPTION_COMPLETE = 'transcription:complete',
  TRANSCRIPTION_ERROR = 'transcription:error',

  // Session events
  SESSION_CREATED = 'session:created',
  SESSION_UPDATED = 'session:updated',
  SESSION_DELETED = 'session:deleted',

  // UI events
  UI_THEME_CHANGED = 'ui:theme_changed',
  UI_MODE_CHANGED = 'ui:mode_changed',

  // Audio events
  AUDIO_LEVEL_UPDATE = 'audio:level_update',
  AUDIO_DEVICE_CHANGED = 'audio:device_changed',

  // Notes events
  NOTES_SAVED = 'notes:saved',
  NOTES_AUTO_SAVED = 'notes:auto_saved',
}
