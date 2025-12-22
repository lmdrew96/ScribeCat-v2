/**
 * NuggetNotesPanel
 * Read-only UI component for displaying AI-generated notes.
 * Renders notes as simple bubbles with timestamps.
 * Stays visible after recording stops until session reset.
 */

import type { NuggetNote } from './NuggetNotesService.js';

/**
 * Options for NuggetNotesPanel
 */
export interface NuggetNotesPanelOptions {
  /** Called when notes are updated (for parent components to react) */
  onNotesUpdate?: (notes: NuggetNote[]) => void;
}

/**
 * Panel for displaying Nugget's auto-generated notes
 */
export class NuggetNotesPanel {
  private container: HTMLElement | null = null;
  private notes: NuggetNote[] = [];
  private isRecording = false;
  private options: NuggetNotesPanelOptions;

  constructor(options: NuggetNotesPanelOptions = {}) {
    this.options = options;
  }

  /**
   * Initialize the panel in the given container
   */
  initialize(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  /**
   * Mark recording as started
   */
  startRecording(): void {
    this.isRecording = true;
    this.render();
  }

  /**
   * Mark recording as stopped (but keep notes visible)
   */
  stopRecording(): void {
    this.isRecording = false;
    this.render();
  }

  /**
   * Update displayed notes
   */
  updateNotes(notes: NuggetNote[]): void {
    this.notes = notes;
    this.render();
    this.options.onNotesUpdate?.(notes);
  }

  /**
   * Clear all notes (for session reset)
   */
  clearNotes(): void {
    this.notes = [];
    this.isRecording = false;
    this.render();
  }

  /**
   * Get current notes
   */
  getNotes(): NuggetNote[] {
    return [...this.notes];
  }

  /**
   * Render the panel HTML
   */
  private render(): void {
    if (!this.container) return;

    if (this.notes.length === 0) {
      this.container.innerHTML = this.renderEmptyState();
      return;
    }

    const notesHtml = this.notes
      .map(note => this.renderNote(note))
      .join('');

    this.container.innerHTML = `
      <div class="nugget-notes-list">
        ${notesHtml}
      </div>
      ${this.isRecording ? '<div class="nugget-notes-recording-indicator">Notes in progress...</div>' : ''}
    `;

    // Auto-scroll to bottom for new notes
    this.container.scrollTop = this.container.scrollHeight;
  }

  /**
   * Render a single note bubble
   */
  private renderNote(note: NuggetNote): string {
    return `
      <div class="nugget-note-bubble" data-note-id="${note.id}">
        <span class="nugget-note-text">${this.escapeHtml(note.text)}</span>
      </div>
    `;
  }

  /**
   * Render empty state message
   */
  private renderEmptyState(): string {
    if (this.isRecording) {
      return `
        <div class="nugget-notes-empty">
          <div class="nugget-notes-empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </div>
          <p class="nugget-notes-empty-title">Listening...</p>
          <p class="nugget-notes-empty-subtitle">Nugget will generate notes as you record</p>
        </div>
      `;
    }

    return `
      <div class="nugget-notes-empty">
        <div class="nugget-notes-empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <line x1="10" y1="9" x2="8" y2="9"></line>
          </svg>
        </div>
        <p class="nugget-notes-empty-title">No notes yet</p>
        <p class="nugget-notes-empty-subtitle">Start recording to generate AI notes</p>
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
