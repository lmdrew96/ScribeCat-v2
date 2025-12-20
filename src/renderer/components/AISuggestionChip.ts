/**
 * AISuggestionChip
 *
 * Floating chip that displays smart AI suggestions during recording.
 * Non-intrusive, dismissible, and delightfully animated.
 */

import type { SmartSuggestion } from '../ai/SmartSuggestionEngine.js';

export class AISuggestionChip {
  private chip: HTMLElement | null = null;
  private isVisible: boolean = false;
  private currentSuggestion: SmartSuggestion | null = null;
  private onAccept?: (suggestion: SmartSuggestion) => void;
  private onDismiss?: (suggestion: SmartSuggestion) => void;

  constructor() {
    // Chip will be created in initialize()
  }

  /**
   * Initialize the suggestion chip
   */
  public initialize(
    onAccept: (suggestion: SmartSuggestion) => void,
    onDismiss: (suggestion: SmartSuggestion) => void
  ): void {
    this.onAccept = onAccept;
    this.onDismiss = onDismiss;
    this.createChip();
  }

  /**
   * Create the chip element
   */
  private createChip(): void {
    const chipHTML = `
      <div id="ai-suggestion-chip" class="ai-suggestion-chip" style="display: none;">
        <div class="suggestion-chip-content">
          <div class="suggestion-chip-icon">
            <span id="suggestion-icon">🤖</span>
          </div>
          <div class="suggestion-chip-text">
            <div class="suggestion-chip-title" id="suggestion-title">AI Suggestion</div>
            <div class="suggestion-chip-description" id="suggestion-description">
              I have a suggestion for you!
            </div>
          </div>
          <div class="suggestion-chip-actions">
            <button id="suggestion-accept-btn" class="suggestion-btn suggestion-btn-accept" title="Accept">
              ✓
            </button>
            <button id="suggestion-dismiss-btn" class="suggestion-btn suggestion-btn-dismiss" title="Dismiss">
              ×
            </button>
          </div>
        </div>
        <div class="suggestion-chip-pulse"></div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chipHTML);
    this.chip = document.getElementById('ai-suggestion-chip');

    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.chip) return;

    const acceptBtn = document.getElementById('suggestion-accept-btn');
    const dismissBtn = document.getElementById('suggestion-dismiss-btn');

    acceptBtn?.addEventListener('click', () => {
      if (this.currentSuggestion) {
        // Convert SmartSuggestion to SuggestionTrigger-compatible format and call RecordingManager
        this.handleSuggestionAccept(this.currentSuggestion);
        
        // Also call the original callback for state management
        if (this.onAccept) {
          this.onAccept(this.currentSuggestion);
        }
        this.hide();
      }
    });

    dismissBtn?.addEventListener('click', () => {
      if (this.currentSuggestion && this.onDismiss) {
        this.onDismiss(this.currentSuggestion);
        this.hide();
      }
    });

    // Click on chip (not buttons) to expand/show more info
    const chipContent = this.chip.querySelector('.suggestion-chip-content');
    chipContent?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // Don't toggle if clicking buttons
      if (!target.closest('.suggestion-btn')) {
        this.chip?.classList.toggle('expanded');
      }
    });
  }

  /**
   * Handle accepting a suggestion by delegating to RecordingManager
   */
  private handleSuggestionAccept(suggestion: SmartSuggestion): void {
    // Convert SmartSuggestion to a format compatible with RecordingManager.handleSuggestionAction
    // Use preserved originalContext for accurate text and timestamp
    const triggerLike = {
      suggestedAction: suggestion.action,
      reason: suggestion.description,
      confidence: suggestion.confidence,
      context: {
        // Use original text if available, fall back to description
        text: suggestion.originalContext?.text || suggestion.description,
        // Use original timestamp if available (for accurate bookmark/note placement)
        timestamp: suggestion.originalContext?.timestamp,
        importantPointId: suggestion.originalContext?.importantPointId
      }
    };

    // Delegate to RecordingManager
    const recordingManager = (window as any).recordingManager;
    if (recordingManager?.handleSuggestionAction) {
      recordingManager.handleSuggestionAction(triggerLike);
    } else {
      console.warn('RecordingManager not available for chip suggestion action');
    }
  }

  /**
   * Show a suggestion
   */
  public show(suggestion: SmartSuggestion): void {
    if (!this.chip) return;

    this.currentSuggestion = suggestion;

    // Update content
    const icon = document.getElementById('suggestion-icon');
    const title = document.getElementById('suggestion-title');
    const description = document.getElementById('suggestion-description');

    if (icon) icon.textContent = suggestion.icon;
    if (title) title.textContent = suggestion.title;
    if (description) description.textContent = suggestion.description;

    // Apply priority styling
    this.chip.classList.remove('priority-low', 'priority-medium', 'priority-high');
    this.chip.classList.add(`priority-${suggestion.priority}`);

    // Show chip with animation
    this.chip.style.display = 'flex';
    this.isVisible = true;

    // Trigger animation
    setTimeout(() => {
      this.chip?.classList.add('visible');
    }, 10);

    // Auto-dismiss low priority suggestions after 15 seconds
    if (suggestion.priority === 'low' && suggestion.dismissible) {
      setTimeout(() => {
        if (this.isVisible && this.currentSuggestion?.id === suggestion.id) {
          this.hide();
        }
      }, 15000);
    }
  }

  /**
   * Hide the chip
   */
  public hide(): void {
    if (!this.chip) return;

    this.chip.classList.remove('visible', 'expanded');
    this.isVisible = false;

    // Wait for animation before hiding
    setTimeout(() => {
      if (!this.isVisible && this.chip) {
        this.chip.style.display = 'none';
        this.currentSuggestion = null;
      }
    }, 300);
  }

  /**
   * Update suggestion (e.g., if confidence changes)
   */
  public update(suggestion: SmartSuggestion): void {
    if (this.currentSuggestion?.id === suggestion.id) {
      this.show(suggestion); // Re-render with new data
    }
  }

  /**
   * Check if chip is currently visible
   */
  public getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Get current suggestion
   */
  public getCurrentSuggestion(): SmartSuggestion | null {
    return this.currentSuggestion;
  }

  /**
   * Force hide (useful for cleanup)
   */
  public forceHide(): void {
    if (this.chip) {
      this.chip.style.display = 'none';
      this.chip.classList.remove('visible', 'expanded');
      this.isVisible = false;
      this.currentSuggestion = null;
    }
  }
}
