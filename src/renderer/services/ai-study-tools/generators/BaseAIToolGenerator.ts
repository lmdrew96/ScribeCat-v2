/**
 * BaseAIToolGenerator
 *
 * Base class for all AI study tool generators
 * Provides shared functionality for loading transcriptions, handling errors,
 * showing load/regenerate prompts, and saving results.
 */

import type { Session } from '../../../../domain/entities/Session.js';
import { MultiSessionHelper } from '../utils/MultiSessionHelper.js';
import { createLoadingHTML } from '../../../utils/loading-helpers.js';

export interface TranscriptionLoadResult {
  text: string;
  isMultiSession: boolean;
  childSessionTitles?: string[];
}

export abstract class BaseAIToolGenerator {
  /**
   * Load transcription from session (handles both single and multi-session)
   * @returns Transcription data or null if no transcription available
   */
  protected static async loadTranscription(session: Session): Promise<TranscriptionLoadResult | null> {
    const isMultiSession = session.type === 'multi-session-study-set';

    if (isMultiSession) {
      // Load child sessions dynamically
      const childSessions = await MultiSessionHelper.loadChildSessions(session);

      if (childSessions.length === 0) {
        return null;
      }

      // Merge transcriptions from all child sessions
      const transcriptionText = MultiSessionHelper.mergeTranscriptions(childSessions);

      if (!transcriptionText || transcriptionText.trim().length === 0) {
        return null;
      }

      return {
        text: transcriptionText,
        isMultiSession: true,
        childSessionTitles: childSessions.map(s => s.title)
      };
    } else {
      // Single session - combine transcription and notes
      const contentParts: string[] = [];

      // Add transcription if available
      if (session.transcription && session.transcription.fullText) {
        contentParts.push('TRANSCRIPTION:\n');
        contentParts.push(session.transcription.fullText);
      }

      // Add notes if available
      if (session.notes && session.notes.trim().length > 0) {
        if (contentParts.length > 0) {
          contentParts.push('\n\n');
        }
        contentParts.push('NOTES:\n');
        contentParts.push(session.notes);
      }

      // Return null if no content available
      if (contentParts.length === 0) {
        return null;
      }

      return {
        text: contentParts.join(''),
        isMultiSession: false
      };
    }
  }

  /**
   * Show standard error message with AI configuration reminder
   */
  protected static showError(contentArea: HTMLElement, toolName: string, error: Error | unknown): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    contentArea.innerHTML = `
      <div class="study-${toolName}">
        <div style="text-align: center; padding: 20px; color: var(--record-color);">
          Failed to generate ${toolName}: ${errorMessage}
        </div>
        <div style="text-align: center; padding: 10px; color: var(--text-tertiary);">
          Make sure Claude AI is configured in Settings.
        </div>
      </div>
    `;
  }

  /**
   * Show standard "no transcription" error
   */
  protected static showNoTranscriptionError(contentArea: HTMLElement, toolName: string): void {
    contentArea.innerHTML = `
      <div class="study-${toolName}">
        <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
          No transcription available for this session.
        </div>
      </div>
    `;
  }

  /**
   * Show loading state
   */
  protected static showLoading(contentArea: HTMLElement, message: string): void {
    contentArea.innerHTML = createLoadingHTML(message);
  }

  /**
   * Save AI tool results to session
   */
  protected static async saveResults(session: Session, toolName: string, data: any): Promise<void> {
    session.saveAIToolResult(toolName, data);
    await window.scribeCat.session.update(session.id, session.toJSON());
  }

  /**
   * Show load or regenerate prompt for previously generated results
   *
   * @param session - Current session
   * @param contentArea - Container element
   * @param savedResult - Previously saved result
   * @param icon - Emoji icon for the prompt
   * @param title - Title text (e.g., "Flashcards Available")
   * @param description - Description text (can include HTML)
   * @param onLoad - Callback when "Load Previous" is clicked
   * @param onRegenerate - Callback when "Regenerate" is clicked
   */
  protected static showLoadOrRegeneratePrompt(
    session: Session,
    contentArea: HTMLElement,
    savedResult: any,
    icon: string,
    title: string,
    description: string,
    onLoad: () => void,
    onRegenerate: () => void
  ): void {
    const generatedDate = new Date(savedResult.generatedAt).toLocaleDateString();
    const regenerationCount = savedResult.regenerationCount || 0;

    contentArea.innerHTML = `
      <div class="ai-result-prompt">
        <div class="prompt-header">
          <div class="prompt-icon">${icon}</div>
          <h4>${title}</h4>
        </div>
        <div class="prompt-body">
          <p>${description.replace('{date}', `<strong>${generatedDate}</strong>`)}</p>
          ${regenerationCount > 0 ? `<p class="regeneration-count">Regenerated ${regenerationCount} time${regenerationCount > 1 ? 's' : ''}</p>` : ''}
        </div>
        <div class="prompt-actions">
          <button class="btn-primary" id="load-previous-btn">Load Previous</button>
          <button class="btn-secondary" id="regenerate-btn">Regenerate</button>
        </div>
      </div>
    `;

    // Attach event listeners
    const loadBtn = document.getElementById('load-previous-btn');
    loadBtn?.addEventListener('click', onLoad);

    const regenerateBtn = document.getElementById('regenerate-btn');
    regenerateBtn?.addEventListener('click', onRegenerate);
  }

  /**
   * Call Claude AI with a prompt
   *
   * @param prompt - The prompt to send to Claude
   * @param maxTokens - Optional max tokens for response (default: undefined = use API default)
   * @returns AI response data
   */
  protected static async callAI(prompt: string, maxTokens?: number): Promise<{ success: boolean; data?: string; error?: string }> {
    return window.scribeCat.ai.chat(prompt, [], {
      includeTranscription: false,
      includeNotes: false,
      maxTokens
    });
  }
}
