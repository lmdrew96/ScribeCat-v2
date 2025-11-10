/**
 * FlashcardGenerator
 *
 * Generates interactive flashcards from session content
 */

import type { Session } from '../../../../domain/entities/Session.js';
import { BaseAIToolGenerator } from './BaseAIToolGenerator.js';
import { AIResponseParser } from '../utils/AIResponseParser.js';
import { escapeHtml } from '../../../utils/formatting.js';

export class FlashcardGenerator extends BaseAIToolGenerator {
  /**
   * Generate flashcards from the session
   */
  static async generate(session: Session, contentArea: HTMLElement, forceRegenerate: boolean = false): Promise<void> {
    // Check if we have saved results
    if (!forceRegenerate && session.hasAIToolResult('flashcards')) {
      const savedResult = session.getAIToolResult('flashcards');
      if (savedResult) {
        this.showLoadOrRegeneratePrompt(
          session,
          contentArea,
          savedResult,
          '🃏',
          'Flashcards Available',
          'You have flashcards generated on {date}.',
          () => this.renderFlashcards(savedResult.data, contentArea, session),
          () => this.generate(session, contentArea, true)
        );
        return;
      }
    }

    // Show loading state
    this.showLoading(contentArea, 'Creating flashcards...');

    try {
      // Load transcription
      const transcription = await this.loadTranscription(session);
      if (!transcription) {
        this.showNoTranscriptionError(contentArea, 'flashcards');
        return;
      }

      const { text: transcriptionText, isMultiSession } = transcription;

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

      const result = await this.callAI(prompt);

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
        await this.saveResults(session, 'flashcards', flashcards);

        // Render flashcards with navigation
        this.renderFlashcards(flashcards, contentArea, session);
      } else {
        throw new Error(result.error || 'Failed to generate flashcards');
      }
    } catch (error) {
      console.error('Error generating flashcards:', error);
      this.showError(contentArea, 'flashcards', error);
    }
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
