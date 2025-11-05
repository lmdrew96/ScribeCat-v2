/**
 * StudyModeEventCoordinator
 *
 * Manages event registration and routing for Study Mode.
 * Provides declarative event handling with automatic cleanup.
 */

export interface EventHandler {
  (detail?: any): void | Promise<void>;
}

export interface ButtonEventConfig {
  element: HTMLElement | null;
  handler: EventHandler;
}

export interface DocumentEventConfig {
  eventName: string;
  handler: EventHandler;
}

export interface CustomEventConfig {
  element: HTMLElement | null;
  eventName: string;
  handler: (detail: any) => void | Promise<void>;
}

export interface CallbackEventConfig {
  register: (handler: EventHandler) => void;
  handler: EventHandler;
}

export interface EventCoordinatorSetup {
  buttons?: ButtonEventConfig[];
  documentEvents?: DocumentEventConfig[];
  customEvents?: CustomEventConfig[];
  callbacks?: CallbackEventConfig[];
}

export class StudyModeEventCoordinator {
  private registrations: Array<{
    element: HTMLElement | Document;
    event: string;
    handler: EventListenerOrEventListenerObject;
  }> = [];

  /**
   * Setup all event listeners based on configuration
   */
  public setup(config: EventCoordinatorSetup): void {
    // Setup button click events
    config.buttons?.forEach(({ element, handler }) => {
      if (element) {
        this.addListener(element, 'click', () => handler());
      }
    });

    // Setup document-level custom events
    config.documentEvents?.forEach(({ eventName, handler }) => {
      this.addListener(document, eventName, () => handler());
    });

    // Setup custom events on specific elements
    config.customEvents?.forEach(({ element, eventName, handler }) => {
      if (element) {
        const listener = ((e: CustomEvent) => handler(e.detail)) as EventListener;
        this.addListener(element, eventName, listener);
      }
    });

    // Setup callback-based events
    config.callbacks?.forEach(({ register, handler }) => {
      register(handler);
    });
  }

  /**
   * Add an event listener and track it for cleanup
   */
  private addListener(
    element: HTMLElement | Document,
    event: string,
    handler: EventListenerOrEventListenerObject
  ): void {
    element.addEventListener(event, handler);
    this.registrations.push({ element, event, handler });
  }

  /**
   * Remove all registered event listeners
   */
  public cleanup(): void {
    this.registrations.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.registrations = [];
  }

  /**
   * Get the number of registered listeners (for testing/debugging)
   */
  public getListenerCount(): number {
    return this.registrations.length;
  }
}
