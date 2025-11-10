/**
 * FlashcardGenerator
 *
 * Generates interactive flashcards from session content
 */

import type { Session } from '../../../../domain/entities/Session.js';
import { MultiSessionHelper } from '../utils/MultiSessionHelper.js';
import { AIResponseParser } from '../utils/AIResponseParser.js';
import { escapeHtml } from '../../../utils/formatting.js';
import { createLoadingHTML } from '../../../utils/loading-helpers.js';

export class FlashcardGenerator {
  /**
   * Generate flashcards from the session
   */
  static async generate(session: Session, contentArea: HTMLElement, forceRegenerate: boolean = false): Promise<void> {
    // Check if we have saved results
    if (!forceRegenerate && session.hasAIToolResult('flashcards')) {
      const savedResult = session.getAIToolResult('flashcards');
      if (savedResult) {
        this.showLoadOrRegeneratePrompt(session, contentArea, savedResult);
        return;
      }
    }

    // Show loading state
    contentArea.innerHTML = createLoadingHTML('Creating flashcards...');

    try {
      // Check if this is a multi-session study set
      const isMultiSession = session.type === 'multi-session-study-set';

      let transcriptionText: string;

      if (isMultiSession) {
        // Load child sessions dynamically
        const childSessions = await MultiSessionHelper.loadChildSessions(session);

        if (childSessions.length === 0) {
          contentArea.innerHTML = `
            <div class="study-flashcards">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No child sessions found for this multi-session study set.
              </div>
            </div>
          `;
          return;
        }

        // Merge transcriptions from all child sessions
        transcriptionText = MultiSessionHelper.mergeTranscriptions(childSessions);

        if (!transcriptionText || transcriptionText.trim().length === 0) {
          contentArea.innerHTML = `
            <div class="study-flashcards">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No transcription available in child sessions.
              </div>
            </div>
          `;
          return;
        }
      } else {
        // Single session - check if transcription exists
        if (!session.transcription || !session.transcription.fullText) {
          contentArea.innerHTML = `
            <div class="study-flashcards">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No transcription available for this session.
              </div>
            </div>
          `;
          return;
        }

        transcriptionText = session.transcription.fullText;
      }

      // Use AI to generate flashcards
      const prompt = isMultiSession
        ? `Create 8-12 flashcards from this MULTI-SESSION study set. The transcription contains content from multiple sessions marked with headers like "━━━ SESSION 1: Title ━━━".

For each flashcard:
1. Put the term/concept on the front
2. Provide a SHORT, textbook-style definition on the back (1-2 sentences max, concise and direct)
3. Include which session the content is from (e.g., "(Session 1)" or "(Sessions 2-3)")

Format as a JSON array with objects containing "term", "definition", and "session" fields. Cover important concepts from ALL sessions.

Transcription:
${transcriptionText}`
        : `Create 5-7 flashcards from this transcription. Each flashcard should have a term or concept on the front and a SHORT, textbook-style definition on the back (1-2 sentences max, concise and direct). Format as a JSON array with objects containing "term" and "definition" fields. Focus on the most important concepts and terminology.

Transcription:
${transcriptionText}`;

      const result = await window.scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });

      if (result.success && result.data) {
        // result.data is a string response from AI
        let flashcards: Array<{term: string; definition: string; session?: string}> = [];

        try {
          flashcards = AIResponseParser.parseJsonArray(
            result.data,
            'Flashcards',
            (data): data is Array<{ term: string; definition: string; session?: string }> => {
              return Array.isArray(data) && data.length > 0 &&
                     typeof data[0] === 'object' && 'term' in data[0] && 'definition' in data[0];
            }
          );
        } catch (e) {
          console.error('Failed to parse flashcards:', e);
          throw new Error('Failed to parse flashcards from AI response. The AI may not have returned the expected format.');
        }

        if (flashcards.length === 0) {
          throw new Error('No flashcards generated');
        }

        // Save the results to session
        session.saveAIToolResult('flashcards', flashcards);
        await window.scribeCat.sessions.update(session.id, session.toJSON());

        // Render flashcards with navigation
        this.renderFlashcards(flashcards, contentArea, session);
      } else {
        throw new Error(result.error || 'Failed to generate flashcards');
      }
    } catch (error) {
      console.error('Error generating flashcards:', error);
      contentArea.innerHTML = `
        <div class="study-flashcards">
          <div style="text-align: center; padding: 20px; color: var(--record-color);">
            Failed to generate flashcards: ${error instanceof Error ? error.message : 'Unknown error'}
          </div>
          <div style="text-align: center; padding: 10px; color: var(--text-tertiary);">
            Make sure Claude AI is configured in Settings.
          </div>
        </div>
      `;
    }
  }

  /**
   * Show prompt to load previous or regenerate
   */
  private static showLoadOrRegeneratePrompt(session: Session, contentArea: HTMLElement, savedResult: any): void {
    const generatedDate = new Date(savedResult.generatedAt).toLocaleDateString();
    const regenerationCount = savedResult.regenerationCount || 0;

    contentArea.innerHTML = `
      <div class="ai-result-prompt">
        <div class="prompt-header">
          <div class="prompt-icon">🃏</div>
          <h4>Flashcards Available</h4>
        </div>
        <div class="prompt-body">
          <p>You have flashcards generated on <strong>${generatedDate}</strong>.</p>
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
    loadBtn?.addEventListener('click', () => {
      this.renderFlashcards(savedResult.data, contentArea, session);
    });

    const regenerateBtn = document.getElementById('regenerate-btn');
    regenerateBtn?.addEventListener('click', () => {
      this.generate(session, contentArea, true); // Force regeneration
    });
  }

  /**
   * Render flashcards with navigation
   */
  private static renderFlashcards(flashcards: Array<{term: string; definition: string; session?: string}>, contentArea: HTMLElement, session?: Session): void {
    let currentIndex = 0;
    let isFlipped = false;

    const render = () => {
      const card = flashcards[currentIndex];
      const side = isFlipped ? 'definition' : 'term';
      const label = isFlipped ? 'DEFINITION' : 'TERM';
      const content = isFlipped ? card.definition : card.term;

      contentArea.innerHTML = `
        <div class="study-flashcards">
          <div class="flashcard-controls">
            <div class="flashcard-counter">
              Card ${currentIndex + 1} of ${flashcards.length}
              ${card.session ? `<span class="flashcard-session-badge">${escapeHtml(card.session)}</span>` : ''}
            </div>
            <div class="flashcard-nav">
              <button class="flashcard-nav-btn" id="prev-card-btn" ${currentIndex === 0 ? 'disabled' : ''}>← Previous</button>
              <button class="flashcard-nav-btn" id="next-card-btn" ${currentIndex === flashcards.length - 1 ? 'disabled' : ''}>Next →</button>
            </div>
          </div>

          <div class="flashcard ${isFlipped ? 'flipped' : ''}" id="flashcard">
            <div class="flashcard-side">
              <div class="flashcard-label">${label}</div>
              <div class="flashcard-content">${escapeHtml(content)}</div>
            </div>
            <div class="flashcard-hint">Click to flip</div>
          </div>
        </div>
      `;

      // Add event listeners
      const flashcard = document.getElementById('flashcard');
      flashcard?.addEventListener('click', () => {
        isFlipped = !isFlipped;
        render();
      });

      const prevBtn = document.getElementById('prev-card-btn');
      prevBtn?.addEventListener('click', () => {
        if (currentIndex > 0) {
          currentIndex--;
          isFlipped = false;
          render();
        }
      });

      const nextBtn = document.getElementById('next-card-btn');
      nextBtn?.addEventListener('click', () => {
        if (currentIndex < flashcards.length - 1) {
          currentIndex++;
          isFlipped = false;
          render();
        }
      });
    };

    render();
  }
}
