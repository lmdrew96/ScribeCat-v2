/**
 * ELI5Generator
 *
 * Generates "Explain Like I'm 5" simple explanations for complex concepts
 */

import type { Session } from '../../../../domain/entities/Session.js';
import { MultiSessionHelper } from '../utils/MultiSessionHelper.js';
import { AIResponseParser } from '../utils/AIResponseParser.js';
import { HtmlHelper } from '../utils/HtmlHelper.js';
import { createLoadingHTML } from '../../../utils/loading-helpers.js';

export class ELI5Generator {
  /**
   * Generate ELI5 (Explain Like I'm 5) explanations for complex concepts
   */
  static async generate(session: Session, contentArea: HTMLElement, forceRegenerate: boolean = false): Promise<void> {
    // Check if we have saved results
    if (!forceRegenerate && session.hasAIToolResult('eli5')) {
      const savedResult = session.getAIToolResult('eli5');
      if (savedResult) {
        this.showLoadOrRegeneratePrompt(session, contentArea, savedResult);
        return;
      }
    }

    // Show loading state
    contentArea.innerHTML = createLoadingHTML('Finding complex concepts to simplify...');

    try {
      const isMultiSession = session.type === 'multi-session-study-set';
      let transcriptionText: string;

      if (isMultiSession) {
        const childSessions = await MultiSessionHelper.loadChildSessions(session);
        if (childSessions.length === 0 || !(transcriptionText = MultiSessionHelper.mergeTranscriptions(childSessions))) {
          contentArea.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No content available.</div>`;
          return;
        }
      } else {
        if (!session.transcription?.fullText) {
          contentArea.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No transcription available.</div>`;
          return;
        }
        transcriptionText = session.transcription.fullText;
      }

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

      const result = await window.scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });

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
        session.saveAIToolResult('eli5', explanations);
        await window.scribeCat.sessions.update(session.id, session.toJSON());

        // Render explanations
        this.renderExplanations(explanations, contentArea, session);
      } else {
        throw new Error(result.error || 'Failed to generate ELI5 explanations');
      }
    } catch (error) {
      console.error('Error generating ELI5:', error);
      contentArea.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--record-color);">
          Failed to generate explanations: ${error instanceof Error ? error.message : 'Unknown error'}
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
          <div class="prompt-icon">🤔</div>
          <h4>ELI5 Explanation Available</h4>
        </div>
        <div class="prompt-body">
          <p>You have ELI5 explanations generated on <strong>${generatedDate}</strong>.</p>
          ${regenerationCount > 0 ? `<p class="regeneration-count">Regenerated ${regenerationCount} time${regenerationCount > 1 ? 's' : ''}</p>` : ''}
        </div>
        <div class="prompt-actions">
          <button class="btn-primary" id="load-previous-btn">Load Previous</button>
          <button class="btn-secondary" id="regenerate-btn">Regenerate</button>
        </div>
      </div>
    `;

    const loadBtn = document.getElementById('load-previous-btn');
    loadBtn?.addEventListener('click', () => {
      this.renderExplanations(savedResult.data, contentArea, session);
    });

    const regenerateBtn = document.getElementById('regenerate-btn');
    regenerateBtn?.addEventListener('click', () => {
      this.generate(session, contentArea, true);
    });
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
                <span class="eli5-concept-name">${HtmlHelper.escapeHtml(item.concept)}</span>
                ${item.session ? `<span class="eli5-session-badge">${HtmlHelper.escapeHtml(item.session)}</span>` : ''}
              </div>
              <div class="eli5-explanation">
                ${HtmlHelper.escapeHtml(item.simpleExplanation)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}
