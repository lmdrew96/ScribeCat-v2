/**
 * LiveSuggestionsPanel
 *
 * Live AI assistance during recording sessions.
 * Integrated into chat drawer, shows real-time insights.
 */

import { ContentAnalyzer, SuggestionTrigger } from '../ai/ContentAnalyzer.js';
import { escapeHtml } from '../utils/formatting.js';
import { getIconHTML } from '../utils/iconMap.js';

export interface LiveSuggestionsOptions {
  onSuggestionClick?: (suggestion: SuggestionTrigger) => void;
  onBadgeUpdate?: (count: number) => void;
}

export class LiveSuggestionsPanel {
  private currentSuggestions: SuggestionTrigger[] = [];
  private isRecording: boolean = false;
  private contentAnalyzer: ContentAnalyzer;
  private options: LiveSuggestionsOptions;

  // Recording timing
  private recordingDuration: number = 0; // in minutes

  constructor(contentAnalyzer: ContentAnalyzer, options: LiveSuggestionsOptions = {}) {
    this.contentAnalyzer = contentAnalyzer;
    this.options = options;
  }

  /**
   * Start recording mode
   */
  public startRecording(): void {
    this.isRecording = true;
    this.currentSuggestions = [];
    this.recordingDuration = 0;
    this.updateBadge();
  }

  /**
   * Stop recording mode
   */
  public stopRecording(): void {
    this.isRecording = false;
    this.currentSuggestions = [];
    this.recordingDuration = 0;
    this.updateBadge();
  }

  /**
   * Update with latest suggestions from ContentAnalyzer
   */
  public updateSuggestions(transcription: string, notes: string, durationMinutes: number): void {
    if (!this.isRecording) return;

    // Update duration
    this.recordingDuration = durationMinutes;

    // Get fresh insights and suggestions for recording mode
    const insights = this.contentAnalyzer.updateContent(transcription, notes);
    const triggers = this.contentAnalyzer.getSuggestionTriggers('recording');

    // Break suggestions removed - they're disruptive during recording

    this.currentSuggestions = triggers;

    // Update badge count
    this.updateBadge();
  }


  /**
   * Update badge count
   */
  private updateBadge(): void {
    const count = this.currentSuggestions.length;
    if (this.options.onBadgeUpdate) {
      this.options.onBadgeUpdate(count);
    }
  }

  /**
   * Render suggestions panel HTML for chat drawer
   */
  public renderPanelHTML(): string {
    // Show different empty states based on recording status
    if (this.currentSuggestions.length === 0) {
      // Not recording - show placeholder
      if (!this.isRecording) {
        return `
          <div class="chip-panel-header">
            <div class="chip-panel-title">${getIconHTML('sparkle', { size: 16 })} Live AI</div>
          </div>
          <div class="chip-panel-content">
            <div class="chip-empty-state">
              <div class="chip-empty-icon">${getIconHTML('mic', { size: 32 })}</div>
              <p><strong>Start recording to activate Live AI</strong></p>
              <p class="chip-empty-subtitle">I'll analyze your content in real-time and suggest helpful actions like bookmarking important moments, adding notes, and more.</p>
            </div>
          </div>
        `;
      }

      // Recording but no suggestions yet
      return `
        <div class="chip-panel-header">
          <div class="chip-panel-title">${getIconHTML('sparkle', { size: 16 })} Live AI</div>
          <div class="chip-panel-duration">${this.formatDuration(this.recordingDuration)}</div>
        </div>
        <div class="chip-panel-content">
          <div class="chip-empty-state">
            <div class="chip-empty-icon">${getIconHTML('mic', { size: 32 })}</div>
            <p>Keep recording! I'll suggest helpful actions as I analyze your content.</p>
          </div>
        </div>
      `;
    }

    // Take top 3 suggestions
    const topSuggestions = this.currentSuggestions.slice(0, 3);

    const suggestionsHtml = topSuggestions.map((trigger, index) => {
      const icon = this.getActionIcon(trigger.suggestedAction);
      const confidenceClass = trigger.confidence > 0.8 ? 'high' : trigger.confidence > 0.6 ? 'medium' : 'low';

      return `
        <div class="chip-suggestion" data-index="${index}" data-action="${trigger.suggestedAction}">
          <div class="chip-suggestion-icon">${icon}</div>
          <div class="chip-suggestion-content">
            <div class="chip-suggestion-action">${this.getActionLabel(trigger.suggestedAction)}</div>
            <div class="chip-suggestion-reason">${escapeHtml(trigger.reason)}</div>
          </div>
          <div class="chip-suggestion-confidence ${confidenceClass}"></div>
        </div>
      `;
    }).join('');

    return `
      <div class="chip-panel-header">
        <div class="chip-panel-title">${getIconHTML('sparkle', { size: 16 })} Live AI</div>
        <div class="chip-panel-duration">${this.formatDuration(this.recordingDuration)}</div>
      </div>
      <div class="chip-panel-content">
        <div class="chip-panel-subtitle">Suggested actions</div>
        <div class="chip-suggestions-list">
          ${suggestionsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to suggestion elements
   * Call this after inserting HTML into the DOM
   */
  public attachSuggestionListeners(container: HTMLElement): void {
    const suggestions = container.querySelectorAll('.chip-suggestion');
    suggestions.forEach((el, index) => {
      const trigger = this.currentSuggestions[index];
      if (trigger) {
        el.addEventListener('click', () => {
          this.handleSuggestionClick(trigger);
        });
      }
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

    // Show brief confirmation
    this.showConfirmation(suggestion);
  }

  /**
   * Show brief confirmation notification
   */
  private showConfirmation(suggestion: SuggestionTrigger): void {
    const icon = this.getActionIcon(suggestion.suggestedAction);
    const label = this.getActionLabel(suggestion.suggestedAction);

    const notificationTicker = (window as any).notificationTicker;
    if (notificationTicker) {
      notificationTicker.info(`${icon} ${label}`, 2000);
    }
  }

  /**
   * Get icon for action type
   */
  private getActionIcon(action: string): string {
    const iconSize = 16;
    const icons: Record<string, string> = {
      'bookmark': getIconHTML('bookmark', { size: iconSize }),
      'note_prompt': getIconHTML('pencil', { size: iconSize }),
      'highlight': getIconHTML('star', { size: iconSize }),
      'break': getIconHTML('coffee', { size: iconSize }),
      'flashcards': getIconHTML('layers', { size: iconSize }),
      'quiz': getIconHTML('clipboard', { size: iconSize }),
      'summary': getIconHTML('file', { size: iconSize }),
      'eli5': getIconHTML('helpCircle', { size: iconSize }),
      'notes': getIconHTML('pencil', { size: iconSize })
    };
    return icons[action] || getIconHTML('lightbulb', { size: iconSize });
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
    this.updateBadge();
  }

  /**
   * Reset for new recording session
   */
  public reset(): void {
    this.recordingDuration = 0;
    this.lastBreakSuggestion = 0;
    this.clearSuggestions();
  }
}
