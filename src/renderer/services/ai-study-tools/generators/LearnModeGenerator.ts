/**
 * LearnModeGenerator
 *
 * Creates interactive spaced repetition learning sessions
 */

import type { Session } from '../../../../domain/entities/Session.js';
import { BaseAIToolGenerator } from './BaseAIToolGenerator.js';
import { AIResponseParser } from '../utils/AIResponseParser.js';
import { escapeHtml } from '../../../utils/formatting.js';

export class LearnModeGenerator extends BaseAIToolGenerator {
  /**
   * Generate learn mode with spaced repetition
   */
  static async generate(session: Session, contentArea: HTMLElement, forceRegenerate: boolean = false): Promise<void> {
    // Check if we have saved results
    if (!forceRegenerate && session.hasAIToolResult('learn_mode')) {
      const savedResult = session.getAIToolResult('learn_mode');
      if (savedResult) {
        this.showLoadOrRegeneratePrompt(
          session,
          contentArea,
          savedResult,
          '📚',
          'Learn Mode Available',
          'You have learn mode concepts generated on {date}.',
          () => this.startLearnModeSession(savedResult.data, contentArea, session),
          () => this.generate(session, contentArea, true)
        );
        return;
      }
    }

    // Show loading state
    this.showLoading(contentArea, 'Preparing learn mode...');

    try {
      // Load transcription
      const transcription = await this.loadTranscription(session);
      if (!transcription) {
        this.showNoTranscriptionError(contentArea, 'learn_mode');
        return;
      }

      const { text: transcriptionText } = transcription;

      // Generate concepts for learning
      const prompt = `Create 10-12 key concept pairs for spaced repetition learning from this transcription. Each pair should have a term/concept and its definition.

Format as a JSON array with objects containing "term" and "definition" fields. Focus on the most important concepts that a student needs to master.

Transcription:
${transcriptionText}`;

      const result = await this.callAI(prompt);

      if (result.success && result.data) {
        let concepts: Array<{term: string; definition: string}> = [];

        try {
          concepts = AIResponseParser.parseJsonArray(
            result.data,
            'Learn Mode Concepts',
            (data): data is Array<{ term: string; definition: string }> => {
              return Array.isArray(data) && data.length > 0 &&
                     typeof data[0] === 'object' && 'term' in data[0] && 'definition' in data[0];
            }
          );
        } catch (e) {
          console.error('Failed to parse learn mode concepts:', e);
          throw new Error('Failed to parse concepts from AI response.');
        }

        if (concepts.length === 0) {
          throw new Error('No concepts generated');
        }

        // Save the results to session
        await this.saveResults(session, 'learn_mode', concepts);

        // Start learn mode session
        this.startLearnModeSession(concepts, contentArea, session);
      } else {
        throw new Error(result.error || 'Failed to generate learn mode concepts');
      }
    } catch (error) {
      console.error('Error generating learn mode:', error);
      this.showError(contentArea, 'learn_mode', error);
    }
  }

  /**
   * Start learn mode session
   */
  private static startLearnModeSession(concepts: Array<{term: string; definition: string}>, contentArea: HTMLElement, session?: Session): void {
    let currentIndex = 0;
    let masteredConcepts: Set<number> = new Set();
    let reviewQueue: number[] = Array.from({ length: concepts.length }, (_, i) => i);

    const render = () => {
      if (currentIndex >= reviewQueue.length) {
        // Session complete
        const masteryPercentage = Math.round((masteredConcepts.size / concepts.length) * 100);
        contentArea.innerHTML = `
          <div class="learn-mode-complete">
            <div class="learn-complete-icon">🎉</div>
            <h4>Learning Session Complete!</h4>
            <div class="learn-stats">
              <div class="learn-stat">
                <span class="stat-number">${masteredConcepts.size}</span>
                <span class="stat-label">Mastered</span>
              </div>
              <div class="learn-stat">
                <span class="stat-number">${concepts.length - masteredConcepts.size}</span>
                <span class="stat-label">Review</span>
              </div>
              <div class="learn-stat">
                <span class="stat-number">${masteryPercentage}%</span>
                <span class="stat-label">Progress</span>
              </div>
            </div>
            <button class="learn-restart-btn" id="restart-learn-btn">Start New Session</button>
          </div>
        `;

        const restartBtn = document.getElementById('restart-learn-btn');
        restartBtn?.addEventListener('click', () => {
          currentIndex = 0;
          masteredConcepts.clear();
          reviewQueue = Array.from({ length: concepts.length }, (_, i) => i);
          render();
        });
        return;
      }

      const conceptIndex = reviewQueue[currentIndex];
      const concept = concepts[conceptIndex];
      const isMastered = masteredConcepts.has(conceptIndex);

      contentArea.innerHTML = `
        <div class="learn-mode-session">
          <div class="learn-progress-bar">
            <div class="learn-progress-fill" style="width: ${(currentIndex / reviewQueue.length) * 100}%"></div>
          </div>
          <div class="learn-progress-text">${currentIndex + 1} of ${reviewQueue.length} concepts</div>

          <div class="learn-card">
            <div class="learn-card-term">${escapeHtml(concept.term)}</div>
            <div class="learn-card-definition">${escapeHtml(concept.definition)}</div>
          </div>

          <div class="learn-actions">
            <button class="learn-action-btn learn-still-learning" id="still-learning-btn">
              Still Learning
            </button>
            <button class="learn-action-btn learn-know-it" id="know-it-btn">
              Know It!
            </button>
          </div>

          <div class="learn-stats-mini">
            <span>Mastered: ${masteredConcepts.size}/${concepts.length}</span>
          </div>
        </div>
      `;

      // Event listeners
      const stillLearningBtn = document.getElementById('still-learning-btn');
      stillLearningBtn?.addEventListener('click', () => {
        masteredConcepts.delete(conceptIndex);
        currentIndex++;
        render();
      });

      const knowItBtn = document.getElementById('know-it-btn');
      knowItBtn?.addEventListener('click', () => {
        masteredConcepts.add(conceptIndex);
        currentIndex++;
        render();
      });
    };

    render();
  }
}
