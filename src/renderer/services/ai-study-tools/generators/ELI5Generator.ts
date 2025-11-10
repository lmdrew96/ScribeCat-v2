/**
 * ELI5Generator
 *
 * Generates "Explain Like I'm 5" simple explanations for complex concepts
 */

import type { Session } from '../../../../domain/entities/Session.js';
import { BaseAIToolGenerator } from './BaseAIToolGenerator.js';
import { AIResponseParser } from '../utils/AIResponseParser.js';
import { escapeHtml } from '../../../utils/formatting.js';

export class ELI5Generator extends BaseAIToolGenerator {
  /**
   * Generate ELI5 (Explain Like I'm 5) explanations for complex concepts
   */
  static async generate(session: Session, contentArea: HTMLElement, forceRegenerate: boolean = false): Promise<void> {
    // Check if we have saved results
    if (!forceRegenerate && session.hasAIToolResult('eli5')) {
      const savedResult = session.getAIToolResult('eli5');
      if (savedResult) {
        this.showLoadOrRegeneratePrompt(
          session,
          contentArea,
          savedResult,
          '🤔',
          'ELI5 Explanation Available',
          'You have ELI5 explanations generated on {date}.',
          () => this.renderExplanations(savedResult.data, contentArea, session),
          () => this.generate(session, contentArea, true)
        );
        return;
      }
    }

    // Show loading state
    this.showLoading(contentArea, 'Finding complex concepts to simplify...');

    try {
      // Load transcription
      const transcription = await this.loadTranscription(session);
      if (!transcription) {
        this.showNoTranscriptionError(contentArea, 'eli5');
        return;
      }

      const { text: transcriptionText, isMultiSession } = transcription;

      // Use AI to identify complex concepts and create simple explanations
      const prompt = isMultiSession
        ? `Analyze this MULTI-SESSION transcription and identify 5-7 concepts that might be difficult to understand. For each concept, provide an "Explain Like I'm 5" (ELI5) version - a super simple explanation using everyday language and analogies.

For each concept:
1. The complex concept/term name
2. A simple, beginner-friendly explanation (use analogies, avoid jargon)
3. Which session it's from (if the transcription has session markers like "━━━ SESSION 1 ━━━")

Format as JSON array with "concept", "simpleExplanation", and "session" fields.

Transcription:
${transcriptionText}`
        : `Analyze this transcription and identify 5-7 concepts that might be difficult to understand. For each concept, provide an "Explain Like I'm 5" (ELI5) version - a super simple explanation using everyday language and analogies.

For each concept:
1. The complex concept/term name
2. A simple, beginner-friendly explanation (use analogies, avoid jargon)

Format as JSON array with "concept" and "simpleExplanation" fields.

Transcription:
${transcriptionText}`;

      const result = await this.callAI(prompt);

      if (result.success && result.data) {
        let explanations: Array<{concept: string; simpleExplanation: string; session?: string}> = [];

        try {
          explanations = AIResponseParser.parseJsonArray(
            result.data,
            'ELI5 Explanations',
            (data): data is Array<{ concept: string; simpleExplanation: string; session?: string }> => {
              return Array.isArray(data) && data.length > 0 &&
                     typeof data[0] === 'object' && 'concept' in data[0] && 'simpleExplanation' in data[0];
            }
          );
        } catch (e) {
          console.error('Failed to parse ELI5 response:', e);
          throw new Error('Invalid response format from AI');
        }

        // Save the results to session
        await this.saveResults(session, 'eli5', explanations);

        // Render explanations
        this.renderExplanations(explanations, contentArea, session);
      } else {
        throw new Error(result.error || 'Failed to generate ELI5 explanations');
      }
    } catch (error) {
      console.error('Error generating ELI5:', error);
      this.showError(contentArea, 'eli5', error);
    }
  }

  /**
   * Render ELI5 explanations
   */
  private static renderExplanations(explanations: Array<{concept: string; simpleExplanation: string; session?: string}>, contentArea: HTMLElement, session?: Session): void {
    contentArea.innerHTML = `
      <div class="eli5-explainer">
        <div class="eli5-header">
          <h4>💡 Complex Concepts Made Simple</h4>
          <p>Here are the tricky concepts explained in simple terms</p>
        </div>
        <div class="eli5-list">
          ${explanations.map(item => `
            <div class="eli5-item">
              <div class="eli5-concept">
                <span class="eli5-icon">🔍</span>
                <span class="eli5-concept-name">${escapeHtml(item.concept)}</span>
                ${item.session ? `<span class="eli5-session-badge">${escapeHtml(item.session)}</span>` : ''}
              </div>
              <div class="eli5-explanation">
                ${escapeHtml(item.simpleExplanation)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}
