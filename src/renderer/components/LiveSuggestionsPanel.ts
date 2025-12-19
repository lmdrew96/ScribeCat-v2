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
  onUndoClick?: () => void;
}

export class LiveSuggestionsPanel {
  private currentSuggestions: SuggestionTrigger[] = [];
  private isRecording: boolean = false;
  private contentAnalyzer: ContentAnalyzer;
  private options: LiveSuggestionsOptions;

  // Recording timing
  private recordingDuration: number = 0; // in minutes

  // Undo state
  private showUndoBar: boolean = false;
  private undoTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastBreakSuggestion: number = 0;

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
            <div class="chip-panel-title">${getIconHTML('sparkle', { size: 16 })} Nugget's Suggestions</div>
          </div>
          <div class="chip-panel-content">
            <div class="chip-empty-state">
              <div class="chip-empty-icon">${getIconHTML('mic', { size: 32 })}</div>
              <p class="chip-empty-title">Start recording to activate suggestions</p>
              <p class="chip-empty-subtitle">I'll analyze your content in real-time and suggest helpful actions like bookmarking important moments, adding notes, and more.</p>
            </div>
          </div>
        `;
      }

      // Recording but no suggestions yet
      return `
        <div class="chip-panel-header">
          <div class="chip-panel-title">${getIconHTML('sparkle', { size: 16 })} Nugget's Suggestions</div>
          <div class="chip-panel-duration">${this.formatDuration(this.recordingDuration)}</div>
        </div>
        <div class="chip-panel-content">
          <div class="chip-empty-state">
            <div class="chip-empty-icon">${getIconHTML('mic', { size: 32 })}</div>
            <p class="chip-empty-title">Keep recording!</p>
            <p class="chip-empty-subtitle">I'll suggest helpful actions as I analyze your content.</p>
          </div>
        </div>
      `;
    }

    // Take top 3 suggestions
    const topSuggestions = this.currentSuggestions.slice(0, 3);

    const suggestionsHtml = topSuggestions.map((trigger, index) => {
      // Get icon and label based on trigger type (for important points) or action
      const { icon, label, typeClass } = this.getTriggerDisplay(trigger);
      const confidenceClass = trigger.confidence > 0.8 ? 'high' : trigger.confidence > 0.6 ? 'medium' : 'low';

      // Get full text from context (not truncated reason)
      const fullText = trigger.context?.text || '';
      const displayText = fullText || trigger.reason;
      const isLongText = displayText.length > 150;
      
      // Format timestamp if available
      const timestamp = trigger.context?.timestamp;
      const formattedTime = timestamp !== undefined ? this.formatTimestampSeconds(timestamp) : '';

      return `
        <div class="chip-suggestion ${typeClass}" data-index="${index}" data-action="${trigger.suggestedAction}">
          <div class="chip-suggestion-icon">${icon}</div>
          <div class="chip-suggestion-content">
            <div class="chip-suggestion-action">
              ${label}
              ${formattedTime ? `<span class="chip-suggestion-time">[${formattedTime}]</span>` : ''}
            </div>
            <div class="chip-suggestion-reason ${isLongText ? 'expandable' : ''}" data-full-text="${escapeHtml(displayText)}">
              ${isLongText ? escapeHtml(displayText.slice(0, 150)) + '...' : escapeHtml(displayText)}
            </div>
            ${isLongText ? `<button class="chip-suggestion-toggle" data-index="${index}">${getIconHTML('chevronDown', { size: 12 })} Show more</button>` : ''}
          </div>
          <div class="chip-suggestion-confidence ${confidenceClass}"></div>
        </div>
      `;
    }).join('');

    // Undo bar HTML
    const undoBarHtml = this.showUndoBar ? `
      <div class="chip-undo-bar">
        <span>Action applied</span>
        <button class="chip-undo-button">${getIconHTML('undo', { size: 14 })} Undo</button>
      </div>
    ` : '';

    return `
      <div class="chip-panel-header">
        <div class="chip-panel-title">${getIconHTML('sparkle', { size: 16 })} Nugget's Suggestions</div>
        <div class="chip-panel-duration">${this.formatDuration(this.recordingDuration)}</div>
      </div>
      ${undoBarHtml}
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
    // Attach click handlers to suggestions
    const suggestions = container.querySelectorAll('.chip-suggestion');
    suggestions.forEach((el, index) => {
      const trigger = this.currentSuggestions[index];
      if (trigger) {
        el.addEventListener('click', (e) => {
          // Don't trigger if clicking the toggle button
          if ((e.target as HTMLElement).closest('.chip-suggestion-toggle')) {
            return;
          }
          this.handleSuggestionClick(trigger);
        });
      }
    });

    // Attach expand/collapse toggle handlers
    const toggleButtons = container.querySelectorAll('.chip-suggestion-toggle');
    toggleButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const button = e.currentTarget as HTMLButtonElement;
        const suggestionEl = button.closest('.chip-suggestion');
        const reasonEl = suggestionEl?.querySelector('.chip-suggestion-reason');
        
        if (reasonEl && reasonEl.classList.contains('expandable')) {
          const isExpanded = reasonEl.classList.toggle('expanded');
          const fullText = reasonEl.getAttribute('data-full-text') || '';
          
          if (isExpanded) {
            reasonEl.textContent = fullText;
            button.innerHTML = `${getIconHTML('chevronUp', { size: 12 })} Show less`;
          } else {
            reasonEl.textContent = fullText.slice(0, 150) + '...';
            button.innerHTML = `${getIconHTML('chevronDown', { size: 12 })} Show more`;
          }
        }
      });
    });

    // Attach undo button handler
    const undoButton = container.querySelector('.chip-undo-button');
    if (undoButton) {
      undoButton.addEventListener('click', () => {
        this.hideUndoBar();
        if (this.options.onUndoClick) {
          this.options.onUndoClick();
        }
      });
    }
  }

  /**
   * Handle suggestion click
   */
  private handleSuggestionClick(suggestion: SuggestionTrigger): void {
    // Call callback if provided
    if (this.options.onSuggestionClick) {
      this.options.onSuggestionClick(suggestion);
    }

    // Show undo bar for 3 seconds
    this.showUndoBarWithTimeout();
  }

  /**
   * Show the undo bar and auto-hide after 3 seconds
   */
  private showUndoBarWithTimeout(): void {
    // Clear any existing timeout
    if (this.undoTimeout) {
      clearTimeout(this.undoTimeout);
    }

    this.showUndoBar = true;
    
    // Re-render to show the undo bar
    this.triggerRerender();

    // Auto-hide after 3 seconds
    this.undoTimeout = setTimeout(() => {
      this.hideUndoBar();
    }, 3000);
  }

  /**
   * Hide the undo bar
   */
  private hideUndoBar(): void {
    if (this.undoTimeout) {
      clearTimeout(this.undoTimeout);
      this.undoTimeout = null;
    }
    this.showUndoBar = false;
    this.triggerRerender();
  }

  /**
   * Trigger a re-render of the panel
   * This is called after showing/hiding the undo bar
   */
  private triggerRerender(): void {
    // Find the suggestions panel container and update it
    const container = document.querySelector('.chat-suggestions-panel');
    if (container) {
      container.innerHTML = this.renderPanelHTML();
      this.attachSuggestionListeners(container as HTMLElement);
    }
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
   * Get display properties for a trigger based on its type
   * Returns icon, label, and CSS class for styling
   */
  private getTriggerDisplay(trigger: SuggestionTrigger): { icon: string; label: string; typeClass: string } {
    const iconSize = 16;

    // Check for important point triggers first
    if (trigger.type === 'important_moment') {
      const isExam = trigger.context?.detectionMethod === 'exam';
      if (isExam) {
        return {
          icon: getIconHTML('alert', { size: iconSize }),
          label: 'Exam Material',
          typeClass: 'chip-suggestion-exam'
        };
      }
      return {
        icon: getIconHTML('star', { size: iconSize }),
        label: 'Important Point',
        typeClass: 'chip-suggestion-emphasis'
      };
    }

    if (trigger.type === 'topic_emphasis') {
      return {
        icon: getIconHTML('refresh', { size: iconSize }),
        label: 'Key Concept',
        typeClass: 'chip-suggestion-repetition'
      };
    }

    // Default to action-based display
    return {
      icon: this.getActionIcon(trigger.suggestedAction),
      label: this.getActionLabel(trigger.suggestedAction),
      typeClass: ''
    };
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
   * Format timestamp in seconds to MM:SS or HH:MM:SS
   */
  private formatTimestampSeconds(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    this.hideUndoBar();
    this.clearSuggestions();
  }
}
