/**
 * FloatingAIChip
 *
 * Live AI assistance during recording sessions.
 * Pulses when suggestions are available, shows real-time insights.
 */

import { ContentAnalyzer, SuggestionTrigger } from '../ai/ContentAnalyzer.js';

export interface FloatingChipOptions {
  onSuggestionClick?: (suggestion: SuggestionTrigger) => void;
  onDismiss?: () => void;
}

export class FloatingAIChip {
  private chip: HTMLElement | null = null;
  private suggestionPanel: HTMLElement | null = null;
  private currentSuggestions: SuggestionTrigger[] = [];
  private isVisible: boolean = false;
  private isPanelOpen: boolean = false;
  private contentAnalyzer: ContentAnalyzer;
  private options: FloatingChipOptions;

  // Recording timing
  private recordingDuration: number = 0; // in minutes
  private lastBreakSuggestion: number = 0;

  constructor(contentAnalyzer: ContentAnalyzer, options: FloatingChipOptions = {}) {
    this.contentAnalyzer = contentAnalyzer;
    this.options = options;
    this.setupUI();
  }

  /**
   * Set up UI elements
   */
  private setupUI(): void {
    // Create floating chip button
    this.chip = document.createElement('button');
    this.chip.id = 'floating-ai-chip';
    this.chip.className = 'floating-ai-chip hidden';
    this.chip.innerHTML = `
      <div class="chip-icon">✨</div>
      <div class="chip-pulse"></div>
    `;

    // Create suggestion panel
    this.suggestionPanel = document.createElement('div');
    this.suggestionPanel.id = 'ai-chip-panel';
    this.suggestionPanel.className = 'ai-chip-panel hidden';

    // Add to DOM
    document.body.appendChild(this.chip);
    document.body.appendChild(this.suggestionPanel);

    // Event listeners
    this.chip.addEventListener('click', () => this.togglePanel());

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isPanelOpen &&
          !this.chip?.contains(e.target as Node) &&
          !this.suggestionPanel?.contains(e.target as Node)) {
        this.closePanel();
      }
    });
  }

  /**
   * Show the chip during recording
   */
  public show(): void {
    if (this.chip) {
      this.chip.classList.remove('hidden');
      this.isVisible = true;
    }
  }

  /**
   * Hide the chip when not recording
   */
  public hide(): void {
    if (this.chip) {
      this.chip.classList.add('hidden');
      this.isVisible = false;
      this.closePanel();
    }
  }

  /**
   * Update with latest suggestions from ContentAnalyzer
   */
  public updateSuggestions(transcription: string, notes: string, durationMinutes: number): void {
    if (!this.isVisible) return;

    // Update duration
    this.recordingDuration = durationMinutes;

    // Get fresh insights and suggestions for recording mode
    const insights = this.contentAnalyzer.updateContent(transcription, notes);
    const triggers = this.contentAnalyzer.getSuggestionTriggers('recording');

    // Add duration-based break suggestion if needed
    if (this.shouldSuggestBreak(durationMinutes)) {
      triggers.push({
        type: 'duration',
        confidence: 0.75,
        reason: `You've been recording for ${Math.round(durationMinutes)} minutes`,
        suggestedAction: 'break',
        mode: 'recording',
        context: { durationMinutes }
      });
      this.lastBreakSuggestion = durationMinutes;
    }

    this.currentSuggestions = triggers;

    // Update chip appearance
    if (triggers.length > 0) {
      this.chip?.classList.add('has-suggestions');
    } else {
      this.chip?.classList.remove('has-suggestions');
    }

    // Update panel if open
    if (this.isPanelOpen) {
      this.renderPanel();
    }
  }

  /**
   * Should we suggest a break?
   */
  private shouldSuggestBreak(durationMinutes: number): boolean {
    // Suggest break every 25 minutes (Pomodoro-style)
    const breakInterval = 25;

    if (durationMinutes >= breakInterval &&
        durationMinutes - this.lastBreakSuggestion >= breakInterval) {
      return true;
    }

    return false;
  }

  /**
   * Toggle suggestion panel
   */
  private togglePanel(): void {
    if (this.isPanelOpen) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  /**
   * Open suggestion panel
   */
  private openPanel(): void {
    if (!this.suggestionPanel) return;

    this.isPanelOpen = true;
    this.suggestionPanel.classList.remove('hidden');
    this.renderPanel();

    // Animate in
    requestAnimationFrame(() => {
      this.suggestionPanel?.classList.add('show');
    });
  }

  /**
   * Close suggestion panel
   */
  private closePanel(): void {
    if (!this.suggestionPanel) return;

    this.suggestionPanel.classList.remove('show');
    this.isPanelOpen = false;

    // Wait for animation before hiding
    setTimeout(() => {
      if (!this.isPanelOpen) {
        this.suggestionPanel?.classList.add('hidden');
      }
    }, 200);
  }

  /**
   * Render suggestion panel content
   */
  private renderPanel(): void {
    if (!this.suggestionPanel) return;

    if (this.currentSuggestions.length === 0) {
      this.suggestionPanel.innerHTML = `
        <div class="chip-panel-header">
          <div class="chip-panel-title">✨ Live AI</div>
          <div class="chip-panel-duration">${this.formatDuration(this.recordingDuration)}</div>
        </div>
        <div class="chip-panel-content">
          <div class="chip-empty-state">
            <div class="chip-empty-icon">🎙️</div>
            <p>Keep recording! I'll suggest helpful actions as I analyze your content.</p>
          </div>
        </div>
      `;
      return;
    }

    // Take top 3 suggestions
    const topSuggestions = this.currentSuggestions.slice(0, 3);

    const suggestionsHtml = topSuggestions.map((trigger, index) => {
      const icon = this.getActionIcon(trigger.suggestedAction);
      const confidenceClass = trigger.confidence > 0.8 ? 'high' : trigger.confidence > 0.6 ? 'medium' : 'low';

      return `
        <div class="chip-suggestion" data-index="${index}">
          <div class="chip-suggestion-icon">${icon}</div>
          <div class="chip-suggestion-content">
            <div class="chip-suggestion-action">${this.getActionLabel(trigger.suggestedAction)}</div>
            <div class="chip-suggestion-reason">${this.escapeHtml(trigger.reason)}</div>
          </div>
          <div class="chip-suggestion-confidence ${confidenceClass}"></div>
        </div>
      `;
    }).join('');

    this.suggestionPanel.innerHTML = `
      <div class="chip-panel-header">
        <div class="chip-panel-title">✨ Live AI</div>
        <div class="chip-panel-duration">${this.formatDuration(this.recordingDuration)}</div>
      </div>
      <div class="chip-panel-content">
        <div class="chip-panel-subtitle">Suggested actions</div>
        <div class="chip-suggestions-list">
          ${suggestionsHtml}
        </div>
      </div>
    `;

    // Add click listeners to suggestions
    topSuggestions.forEach((trigger, index) => {
      const suggestionEl = this.suggestionPanel?.querySelector(`[data-index="${index}"]`);
      suggestionEl?.addEventListener('click', () => {
        this.handleSuggestionClick(trigger);
      });
    });
  }

  /**
   * Handle suggestion click
   */
  private handleSuggestionClick(suggestion: SuggestionTrigger): void {
    // Call callback if provided
    if (this.options.onSuggestionClick) {
      this.options.onSuggestionClick(suggestion);
    }

    // Close panel after action
    this.closePanel();

    // Show brief confirmation
    this.showConfirmation(suggestion);
  }

  /**
   * Show brief confirmation toast
   */
  private showConfirmation(suggestion: SuggestionTrigger): void {
    const icon = this.getActionIcon(suggestion.suggestedAction);
    const label = this.getActionLabel(suggestion.suggestedAction);

    const toast = document.createElement('div');
    toast.className = 'chip-confirmation-toast';
    toast.innerHTML = `<span>${icon}</span> ${label}`;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Remove after 2 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  /**
   * Get icon for action type
   */
  private getActionIcon(action: string): string {
    const icons: Record<string, string> = {
      'bookmark': '🔖',
      'note_prompt': '📝',
      'highlight': '✨',
      'break': '☕',
      'flashcards': '🃏',
      'quiz': '📝',
      'summary': '📄',
      'eli5': '🤔',
      'notes': '✏️'
    };
    return icons[action] || '💡';
  }

  /**
   * Get label for action type
   */
  private getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      'bookmark': 'Bookmark this moment',
      'note_prompt': 'Add notes',
      'highlight': 'Mark as important',
      'break': 'Take a break',
      'flashcards': 'Create flashcards',
      'quiz': 'Generate quiz',
      'summary': 'Summarize',
      'eli5': 'Explain simply',
      'notes': 'Add key points'
    };
    return labels[action] || 'Suggested action';
  }

  /**
   * Format duration for display
   */
  private formatDuration(minutes: number): string {
    if (minutes < 1) return '< 1 min';

    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);

    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins} min`;
  }

  /**
   * Escape HTML for safe rendering
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get current suggestions count
   */
  public getSuggestionsCount(): number {
    return this.currentSuggestions.length;
  }

  /**
   * Clear all suggestions
   */
  public clearSuggestions(): void {
    this.currentSuggestions = [];
    this.chip?.classList.remove('has-suggestions');
    if (this.isPanelOpen) {
      this.renderPanel();
    }
  }

  /**
   * Reset for new recording session
   */
  public reset(): void {
    this.recordingDuration = 0;
    this.lastBreakSuggestion = 0;
    this.clearSuggestions();
    this.closePanel();
  }

  /**
   * Cleanup and remove from DOM
   */
  public destroy(): void {
    this.chip?.remove();
    this.suggestionPanel?.remove();
  }
}
